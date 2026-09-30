/**
 * Production Room Manager for DrawRealm
 * Controls room lifecycle, public/private indexing, reconnection tokens, grace periods, and cleanup.
 */

const crypto = require("crypto");
const Room = require("./room");
const { STATES, SETTINGS, PACKETS } = require("../game/gameEngine");
const config = require("../config");
const db = require("../db/database");

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
    this.socketMap = new Map(); // socket.id -> { room, player }
    this.tokenMap = new Map(); // reconnectToken -> { room, player }
    this.io = null;

    // Start background garbage collector for stale rooms & expired sessions
    this.gcInterval = setInterval(() => {
      this.collectGarbage();
    }, 30000);
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Broadcasts updated public rooms list to all connected clients in real-time
   */
  broadcastPublicRoomsUpdated() {
    if (this.io) {
      const publicRooms = this.getPublicRooms();
      this.io.emit("public_rooms_updated", publicRooms);
      this.io.emit("PUBLIC_ROOMS_UPDATED", publicRooms);
    }
  }

  /**
   * Generates a cryptographically secure, non-predictable 8-character room code
   */
  generateRoomId() {
    let id = "";
    do {
      id = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8);
    } while (this.rooms.has(id) || id.length < 8);
    return id;
  }

  /**
   * Creates a new private room
   */
  createPrivateRoom(lang = 0, options = {}) {
    if (this.rooms.size >= config.MAX_ROOMS) {
      throw new Error("Server room limit reached. Please try again later.");
    }
    const id = this.generateRoomId();
    const parsedLang = (typeof lang === "number" && !isNaN(lang)) ? lang : parseInt(lang, 10) || 0;
    const room = new Room({
      id,
      type: 1,
      lang: parsedLang,
      category: options.category || "Random",
      mode: options.mode !== undefined ? options.mode : 0,
      slots: options.slots !== undefined ? options.slots : 8,
      rounds: options.rounds !== undefined ? options.rounds : 3,
      drawtime: options.drawtime !== undefined ? options.drawtime : 80,
      roomManager: this
    });
    this.rooms.set(id, room);
    console.log(`[RoomManager] Created private room: ${id}`);
    return room;
  }

  /**
   * Creates a new public room explicitly
   */
  createPublicRoom(lang = 0, options = {}) {
    if (this.rooms.size >= config.MAX_ROOMS) {
      throw new Error("Server room limit reached. Please try again later.");
    }
    const id = this.generateRoomId();
    const parsedLang = (typeof lang === "number" && !isNaN(lang)) ? lang : parseInt(lang, 10) || 0;
    const room = new Room({
      id,
      type: 0,
      lang: parsedLang,
      category: options.category || "Random",
      mode: options.mode !== undefined ? options.mode : 0,
      slots: options.slots !== undefined ? options.slots : 8,
      rounds: options.rounds !== undefined ? options.rounds : 3,
      drawtime: options.drawtime !== undefined ? options.drawtime : 80,
      roomManager: this
    });
    this.rooms.set(id, room);
    console.log(`[RoomManager] Created public room: ${id}`);
    this.broadcastPublicRoomsUpdated();
    return room;
  }

  /**
   * Finds an available public room or creates a new one
   */
  findOrCreatePublicRoom(lang = 0, playerName = null, category = "Random") {
    const parsedLang = parseInt(lang, 10) || 0;

    // Search for public room with open slots, in lobby state, and no duplicate name
    for (const room of this.rooms.values()) {
      if (room.type === 0 && room.settings[SETTINGS.LANG] === parsedLang && room.game && room.game.state === STATES.LOBBY) {
        const slots = parseInt(room.settings[SETTINGS.SLOTS], 10) || 8;
        if (room.getActivePlayers().length < slots) {
          if (!playerName || !room.hasPlayerName(playerName)) {
            return room;
          }
        }
      }
    }

    return this.createPublicRoom(parsedLang, { category });
  }

  /**
   * Retrieves an existing room by code
   */
  getRoom(roomId) {
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  /**
   * Associates a socket with a room and player, and registers reconnect token
   */
  bindSocket(socket, room, player) {
    this.socketMap.set(socket.id, { room, player });
    if (player.reconnectToken) {
      this.tokenMap.set(player.reconnectToken, { room, player });
      db.createReconnectSession(player.reconnectToken, player.name, room.id, player.id);
    }
  }

  /**
   * Returns room and player info for a socket
   */
  getSocketSession(socket) {
    return this.socketMap.get(socket.id) || null;
  }

  /**
   * Attempts to reconnect an existing player via reconnectToken or name in room
   */
  tryReconnect(socket, loginData = {}) {
    const token = typeof loginData === "string" ? loginData : (loginData.token || loginData.reconnectToken);
    let targetPlayer = null;
    let room = null;

    // 1. Try finding by reconnectToken
    if (token) {
      let entry = this.tokenMap.get(token);
      if (!entry) {
        const saved = db.getReconnectSession(token);
        if (saved) {
          const r = this.getRoom(saved.room_id);
          if (r) {
            const p = r.players.get(saved.player_id);
            if (p) {
              entry = { room: r, player: p };
              this.tokenMap.set(token, entry);
            }
          }
        }
      }
      if (entry && entry.player && entry.player.disconnected) {
        room = entry.room;
        targetPlayer = entry.player;
      }
    }

    // 2. Fallback: try finding by player name if joinRoomId is provided
    if (!targetPlayer && typeof loginData === "object" && loginData.join && loginData.name) {
      const joinRoomId = String(loginData.join).trim();
      const r = this.getRoom(joinRoomId);
      if (r) {
        const cleanName = String(loginData.name).trim().toLowerCase();
        for (const p of r.players.values()) {
          if (p.disconnected && p.name.trim().toLowerCase() === cleanName) {
            room = r;
            targetPlayer = p;
            break;
          }
        }
      }
    }

    if (!targetPlayer || !room) return null;

    // Clear grace timer
    if (targetPlayer.disconnectTimeout) {
      clearTimeout(targetPlayer.disconnectTimeout);
      targetPlayer.disconnectTimeout = null;
    }

    // Rebind player
    targetPlayer.socket = socket;
    targetPlayer.disconnected = false;
    targetPlayer.disconnectedAt = 0;
    targetPlayer.roomId = room.id;
    if (socket && typeof socket.join === "function") {
      socket.join(room.id);
    }
    this.bindSocket(socket, room, targetPlayer);

    console.log(`[Reconnection] Player ${targetPlayer.name} (${targetPlayer.id}) successfully reconnected to room ${room.id}`);

    // Send state recovery payload to reconnected player
    room.sendFullSync(targetPlayer);

    // Announce reconnection to room
    room.broadcast({
      id: PACKETS.CHAT,
      data: { id: 0, msg: `${targetPlayer.name} reconnected to the game!` }
    });

    return targetPlayer;
  }

  /**
   * Unbinds socket from session mapping
   */
  unbindSocket(socketId) {
    this.socketMap.delete(socketId);
  }

  /**
   * Handles player disconnection with grace period
   */
  handleDisconnect(socket) {
    const session = this.socketMap.get(socket.id);
    if (!session) return;

    const { room, player } = session;
    this.socketMap.delete(socket.id);

    // If already marked or removed, skip
    if (!room.players.has(player.id)) return;
    if (player.disconnected) return;

    player.disconnected = true;
    player.disconnectedAt = Date.now();

    // If the room host disconnects, immediately assign host to the next active player
    if (player.id === room.ownerId) {
      room.transferHostToNextActive();
    }

    const isCurrentDrawer = (room.game.state === STATES.DRAWING && player.id === room.game.currentDrawerId);
    const gracePeriodMs = isCurrentDrawer
      ? config.DRAWER_RECONNECT_GRACE_PERIOD_MS
      : config.RECONNECT_GRACE_PERIOD_MS;

    console.log(`[RoomManager] Player ${player.name} (${player.id}) disconnected from room ${room.id}. Grace period: ${gracePeriodMs / 1000}s`);

    if (isCurrentDrawer) {
      room.broadcast({
        id: PACKETS.CHAT,
        data: { id: 0, msg: `The drawer disconnected! Waiting ${gracePeriodMs / 1000}s for reconnection...` }
      });
    }

    // Start grace timer
    player.disconnectTimeout = setTimeout(() => {
      this.finalizePlayerRemoval(room, player);
    }, gracePeriodMs);
  }

  /**
   * Permanently removes player after grace period expiry
   */
  finalizePlayerRemoval(room, player) {
    if (!room.players.has(player.id) || !player.disconnected) return;

    console.log(`[RoomManager] Grace period expired for ${player.name} (${player.id}) in room ${room.id}. Removing permanently.`);

    if (player.reconnectToken) {
      this.tokenMap.delete(player.reconnectToken);
      db.deleteReconnectSession(player.reconnectToken);
    }

    room.removePlayer(player.id);

    // If room is now empty, delete room
    if (room.getActivePlayers().length === 0) {
      this.destroyRoom(room.id);
    }
  }

  /**
   * Cleans up and destroys a room
   */
  destroyRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`[RoomManager] Cleaning up room: ${roomId}`);
    room.destroy();
    for (const p of room.players.values()) {
      if (p.disconnectTimeout) clearTimeout(p.disconnectTimeout);
      if (p.reconnectToken) {
        this.tokenMap.delete(p.reconnectToken);
        db.deleteReconnectSession(p.reconnectToken);
      }
      if (p.socket) {
        this.socketMap.delete(p.socket.id);
        if (typeof p.socket.leave === "function") {
          p.socket.leave(roomId);
        }
      }
    }
    this.rooms.delete(roomId);
    this.broadcastPublicRoomsUpdated();
  }

  /**
   * Periodic garbage collection of empty/abandoned rooms
   */
  collectGarbage() {
    db.cleanupExpiredSessions();

    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      const activeCount = room.getActivePlayers().length;
      if (activeCount === 0) {
        // Check if any disconnected player is still in grace period
        const hasGrace = Array.from(room.players.values()).some(p => p.disconnectTimeout !== null);
        if (!hasGrace) {
          this.destroyRoom(roomId);
        }
      }
    }
  }

  /**
   * Total count of online active players across all rooms
   */
  getTotalOnlinePlayers() {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.getActivePlayers().length;
    }
    return count;
  }

  /**
   * Total count of games currently in an active round/play state
   */
  getActiveGamesCount() {
    let count = 0;
    for (const room of this.rooms.values()) {
      if (room.game && room.game.state !== STATES.LOBBY && room.game.state !== STATES.GAME_OVER) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns list of public rooms for browser
   */
  getPublicRooms() {
    const list = [];
    const MODE_NAMES = {
      0: "Classic",
      1: "Speed Draw",
      2: "Team Battle",
      3: "Word Rush",
      4: "Mystery Word",
      5: "Chaos Round",
      6: "Evolution"
    };

    for (const room of this.rooms.values()) {
      if (room.type === 0) {
        const modeId = parseInt(room.settings[SETTINGS.WORDMODE], 10) || 0;
        const state = room.game ? room.game.state : STATES.LOBBY;
        const activeCount = room.getActivePlayers().length;
        const maxSlots = parseInt(room.settings[SETTINGS.SLOTS], 10) || 8;
        const isStarted = state !== STATES.LOBBY;
        const isFull = activeCount >= maxSlots;

        let status = "Waiting";
        if (isStarted) {
          status = state === STATES.GAME_OVER ? "Game Over" : "In Game";
        } else if (isFull) {
          status = "Full";
        }

        const hostPlayer = room.players.get(room.ownerId);

        list.push({
          id: room.id,
          code: room.id,
          type: room.type,
          roomType: "public",
          players: activeCount,
          playerCount: activeCount,
          maxPlayers: maxSlots,
          maxSlots: maxSlots,
          mode: modeId,
          gameMode: MODE_NAMES[modeId] || "Classic",
          modeName: MODE_NAMES[modeId] || "Classic",
          category: room.category || "Random",
          status: status,
          isStarted: isStarted,
          isFull: isFull,
          canJoin: !isStarted && !isFull,
          hostPlayerId: room.ownerId,
          hostName: hostPlayer ? hostPlayer.name : "Host",
          round: Math.max(1, room.game ? room.game.currentRound : 1),
          totalRounds: parseInt(room.settings[SETTINGS.ROUNDS], 10) || 3,
          lang: parseInt(room.settings[SETTINGS.LANG], 10) || 0,
          state: state
        });
      }
    }
    return list;
  }
}

module.exports = new RoomManager();
