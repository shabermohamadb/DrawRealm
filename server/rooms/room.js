const Player = require("../players/player");
const { GameEngine, STATES, SETTINGS } = require("../game/gameEngine");
const EvolutionManager = require("../evolution/evolutionManager");
const supabaseService = require("../db/supabaseClient");
const storage = require("../evolution/storage");
const db = require("../db/database");

// Packet IDs
const PACKETS = {
  JOIN: 1,         // ya
  LEAVE: 2,        // va
  KICK: 3,
  BAN: 4,
  VOTEKICK: 5,     // ba
  REPORT: 6,
  MUTE: 7,
  RATE: 8,         // Sa
  ROOM_INIT: 10,   // Ca
  STATE: 11,       // qa
  SETTINGS: 12,    // xa
  OWNER: 17,       // Ea
  DRAW: 19,        // Ia
  CLEAR: 20,       // Ra
  UNDO: 21,        // Ta
  START_GAME: 22,
  CHAT: 30,        // Na
  SYSTEM: 31,      // Wa
  EMOTE: 28
};

class Room {
  /**
   * @param {Object} options
   * @param {string} options.id - Room ID
   * @param {number} options.type - 0 for public, 1 for custom
   * @param {number} options.lang - Initial language ID
   * @param {string} [options.category] - Word category
   * @param {Object} [options.roomManager] - Parent room manager
   */
  constructor({ id, type = 1, lang = 0, category = "Random", mode = 0, slots = 8, rounds = 3, drawtime = 80, roomManager = null }) {
    this.id = id;
    this.type = type;
    this.category = category || "Random";
    this.roomManager = roomManager;
    this.players = new Map(); // id -> Player
    this.nextPlayerId = 1;
    this.ownerId = -1;
    this.bannedIps = new Set();
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();

    // Settings array: [LANG, SLOTS, DRAWTIME, ROUNDS, WORDCOUNT, HINTCOUNT, WORDMODE, CUSTOMWORDSONLY]
    this.settings = [
      parseInt(lang, 10) || 0,                            // 0: Language
      parseInt(slots, 10) || 8,                           // 1: Slots (max players)
      parseInt(drawtime, 10) || 80,                       // 2: Drawtime
      parseInt(rounds, 10) || 3,                          // 3: Rounds
      3,                                                  // 4: Word count
      2,                                                  // 5: Hints
      parseInt(mode, 10) || 0,                            // 6: Game Mode (0: Normal/Classic, 6: Evolution)
      0                                                   // 7: Custom words only (0: No)
    ];

    this.customWords = [];
    this.drawCommands = [];
    this.undoHistory = [];
    this.game = new GameEngine(this);
    this.evolution = new EvolutionManager(this);

    // Create persistent room record in database
    db.createRoomRecord({
      id: this.id,
      roomCode: this.id,
      roomType: this.type === 0 ? "public" : "private",
      hostPlayerId: null,
      gameMode: this.settings[SETTINGS.WORDMODE] === 6 ? "Evolution" : "Classic",
      category: this.category,
      status: "waiting",
      maxPlayers: this.settings[SETTINGS.SLOTS] || 8
    });
  }

  get roomType() {
    return this.type === 0 ? "public" : "private";
  }

  get isStarted() {
    return !!(this.game && this.game.state !== STATES.LOBBY && this.game.state !== STATES.WAITING && this.game.state !== STATES.GAME_OVER);
  }

  onStateChange() {
    if (this.roomManager && typeof this.roomManager.broadcastPublicRoomsUpdated === "function") {
      this.roomManager.broadcastPublicRoomsUpdated();
    }
  }

  getActivePlayers() {
    return Array.from(this.players.values()).filter(p => !p.disconnected && !p.spectator);
  }

  getAllConnectedPlayers() {
    return Array.from(this.players.values()).filter(p => !p.disconnected);
  }

  /**
   * Checks if an active connected player in this room already uses the given name (case-insensitive)
   * @param {string} name
   * @param {number|null} [excludePlayerId]
   * @returns {boolean}
   */
  hasPlayerName(name, excludePlayerId = null) {
    if (!name || typeof name !== "string") return false;
    const target = name.trim().toLowerCase();
    if (!target) return false;
    for (const player of this.players.values()) {
      if (excludePlayerId !== null && player.id === excludePlayerId) continue;
      if (!player.disconnected && player.name && player.name.trim().toLowerCase() === target) {
        return true;
      }
    }
    return false;
  }

  getUsersJSON() {
    return this.getAllConnectedPlayers().map(p => p.toJSON());
  }

  /**
   * Adds a player to the room
   */
  addPlayer(socket, loginData = {}) {
    this.lastActivityAt = Date.now();
    const isSpectator = !!loginData.spectator;
    const maxSlots = parseInt(this.settings[SETTINGS.SLOTS], 10) || 8;

    // Server-side player name validation
    const rawName = (loginData && typeof loginData.name === "string") ? loginData.name : "";
    const cleanName = rawName.trim();
    const validNameRegex = /^[a-zA-Z0-9 _-]+$/;

    if (!cleanName || cleanName.length < 2 || cleanName.length > 20 || !validNameRegex.test(cleanName)) {
      if (socket && typeof socket.emit === "function") {
        let msg = "Please enter your player name.";
        if (cleanName.length > 0 && cleanName.length < 2) {
          msg = "Player name must be at least 2 characters.";
        } else if (cleanName.length > 0 && !validNameRegex.test(cleanName)) {
          msg = "Player name can only contain letters, numbers, spaces, _ and -.";
        } else if (cleanName.length > 20) {
          msg = "Player name must be 20 characters or fewer.";
        }
        socket.emit("joinerr", {
          code: "PLAYER_NAME_INVALID",
          message: msg
        });
      }
      return null;
    }

    // Duplicate name check in the same room (case-insensitive)
    if (this.hasPlayerName(cleanName)) {
      if (socket && typeof socket.emit === "function") {
        socket.emit("joinerr", {
          code: "PLAYER_NAME_TAKEN",
          message: "That player name is already in use in this room."
        });
      }
      return null;
    }

    // Check if room is already started (unless spectator)
    if (this.isStarted && !isSpectator) {
      if (socket && typeof socket.emit === "function") {
        socket.emit("joinerr", {
          code: "ROOM_ALREADY_STARTED",
          message: "Game has already started in this room."
        });
      }
      return null;
    }

    // Server-side atomic capacity check to protect against simultaneous join race conditions
    if (!isSpectator && this.getActivePlayers().length >= maxSlots) {
      if (socket && typeof socket.emit === "function") {
        socket.emit("joinerr", {
          code: "ROOM_FULL",
          message: "Room is full."
        });
        socket.emit("joinerr", 2);
      }
      return null;
    }

    const isFirst = this.players.size === 0;
    const playerId = this.nextPlayerId++;
    const flags = isFirst ? 4 : 0; // Host gets admin flags (4)

    const player = new Player({
      id: playerId,
      socket,
      roomId: this.id,
      name: cleanName,
      avatar: loginData.avatar,
      flags,
      spectator: isSpectator
    });

    if (socket && typeof socket.join === "function") {
      socket.join(this.id);
    }

    this.players.set(playerId, player);
    if (isFirst) {
      this.ownerId = playerId;
      db.updateRoomRecord(this.id, { hostPlayerId: playerId });
    }

    db.addRoomPlayer({
      roomId: this.id,
      playerId: playerId,
      playerName: cleanName,
      role: isFirst ? "host" : (isSpectator ? "spectator" : "player")
    });

    this.onStateChange();

    // Determine current state payload for late-joiners
    let stateData = 0;
    if (this.game.state === STATES.ROUND_START) {
      stateData = this.game.currentRound - 1;
    } else if (this.game.state === STATES.WORD_CHOICE) {
      stateData = { id: this.game.currentDrawerId };
    } else if (this.game.state === STATES.DRAWING) {
      const wordLengths = this.game.secretWord.split(" ").map(w => w.length);
      stateData = {
        id: this.game.currentDrawerId,
        word: wordLengths,
        hints: this.game.hints,
        drawCommands: this.drawCommands
      };
    }

    // Authoritative remaining time
    let calculatedTime = this.game.timeLeft;
    if (this.game.roundEndsAt && this.game.state === STATES.DRAWING) {
      calculatedTime = Math.max(0, Math.ceil((this.game.roundEndsAt - Date.now()) / 1000));
    }

    // Send Room Init (Ca = 10) to joining player with reconnect token
    socket.emit("data", {
      id: PACKETS.ROOM_INIT,
      data: {
        me: playerId,
        type: this.type,
        roomType: this.roomType,
        id: this.id,
        category: this.category,
        settings: this.settings,
        users: this.getUsersJSON(),
        round: Math.max(0, this.game.currentRound - 1),
        owner: this.ownerId,
        state: {
          id: this.game.state,
          time: calculatedTime,
          data: stateData
        },
        reconnectToken: player.reconnectToken
      }
    });

    // Also emit session handshake for client persistence
    socket.emit("drawrealm:session", {
      token: player.reconnectToken,
      roomId: this.id,
      playerId: player.id
    });

    // Broadcast Player Joined (ya = 1) to other players
    this.broadcastToOthers(socket, {
      id: PACKETS.JOIN,
      data: player.toJSON()
    });

    // Initialize evolution state for this player
    this.evolution.initPlayer(player);

    // Asynchronously resolve/sync Supabase persistent profile
    if (supabaseService.isConfigured) {
      supabaseService.getOrCreatePlayer(player.name, player.name).then(remote => {
        if (remote && remote.id) {
          player.profileId = remote.id;
          if (remote.evolution) {
            const local = storage.getProfile(player.name);
            let needsSync = false;
            if (remote.evolution.xp > (local.xp || 0)) {
              local.xp = remote.evolution.xp;
              local.level = remote.evolution.level;
              needsSync = true;
            }
            if (Array.isArray(remote.evolution.unlockedPowers) && remote.evolution.unlockedPowers.length > 0) {
              local.unlockedPowers = Array.from(new Set([...(local.unlockedPowers || []), ...remote.evolution.unlockedPowers]));
              needsSync = true;
            }
            if (Array.isArray(remote.evolution.equippedPowers) && remote.evolution.equippedPowers.length > 0) {
              local.equippedPowers = remote.evolution.equippedPowers;
              needsSync = true;
            }
            if (needsSync) {
              storage.save();
            }
            if (this.evolution) {
              const evoState = this.evolution.getPlayerState(player.id);
              if (evoState) {
                evoState.xp = local.xp || 0;
                evoState.level = local.level || 0;
                if (Array.isArray(local.equippedPowers) && local.equippedPowers.length > 0) {
                  evoState.equippedPowers = [...local.equippedPowers];
                }
                if (local.ultimatePower) {
                  evoState.ultimatePower = local.ultimatePower;
                }
              }
              this.evolution.syncPlayerState(player);
            }
          }
        }
      }).catch(err => {
        console.warn(`[Room ${this.id}] Supabase profile sync warning for ${player.name}:`, err.message);
      });
    }

    return player;
  }

  /**
   * Fully synchronizes room state for a reconnected player
   */
  sendFullSync(player) {
    this.lastActivityAt = Date.now();
    let stateData = 0;
    if (this.game.state === STATES.ROUND_START) {
      stateData = this.game.currentRound - 1;
    } else if (this.game.state === STATES.WORD_CHOICE) {
      stateData = { id: this.game.currentDrawerId };
    } else if (this.game.state === STATES.DRAWING) {
      const isDrawer = player.id === this.game.currentDrawerId;
      const wordLengths = this.game.secretWord.split(" ").map(w => w.length);
      stateData = {
        id: this.game.currentDrawerId,
        word: isDrawer ? this.game.secretWord : wordLengths,
        hints: this.game.hints,
        drawCommands: this.drawCommands
      };
    }

    let calculatedTime = this.game.timeLeft;
    if (this.game.roundEndsAt && this.game.state === STATES.DRAWING) {
      calculatedTime = Math.max(0, Math.ceil((this.game.roundEndsAt - Date.now()) / 1000));
    }

    // Re-send Room Init packet
    player.socket.emit("data", {
      id: PACKETS.ROOM_INIT,
      data: {
        me: player.id,
        type: this.type,
        roomType: this.roomType,
        id: this.id,
        category: this.category,
        settings: this.settings,
        users: this.getUsersJSON(),
        round: Math.max(0, this.game.currentRound - 1),
        owner: this.ownerId,
        state: {
          id: this.game.state,
          time: calculatedTime,
          data: stateData
        },
        reconnectToken: player.reconnectToken
      }
    });

    player.socket.emit("drawrealm:session", {
      token: player.reconnectToken,
      roomId: this.id,
      playerId: player.id
    });

    // Sync evolution progression state
    this.evolution.syncPlayerState(player);
  }

  /**
   * Promotes the next active connected player to room host
   */
  /**
   * Promotes the next active connected player to room host
   */
  transferHostToNextActive() {
    const remaining = this.getActivePlayers();
    if (remaining.length > 0) {
      this.ownerId = remaining[0].id;
      remaining[0].flags = 4;
      this.broadcast({
        id: PACKETS.OWNER,
        data: this.ownerId
      });
      this.broadcastCustom("evolution:host_changed", {
        hostId: this.ownerId,
        hostName: remaining[0].name
      });
      db.updateRoomRecord(this.id, { hostPlayerId: this.ownerId });
      this.onStateChange();
      return remaining[0];
    } else {
      this.ownerId = -1;
      db.updateRoomRecord(this.id, { hostPlayerId: null });
      this.onStateChange();
      return null;
    }
  }

  /**
   * Removes a player from the room permanently
   */
  removePlayer(playerId, reason = 0) {
    this.lastActivityAt = Date.now();
    const player = this.players.get(playerId);
    if (!player) return;

    if (player.socket && typeof player.socket.leave === "function") {
      player.socket.leave(this.id);
    }

    this.players.delete(playerId);

    db.updateRoomPlayerLeft({ roomId: this.id, playerId });
    this.onStateChange();

    // Broadcast player left (va = 2)
    this.broadcast({
      id: PACKETS.LEAVE,
      data: { id: playerId, reason }
    });

    // Transfer ownership if owner left
    if (playerId === this.ownerId) {
      this.transferHostToNextActive();
    }

    // Notify game engine
    this.game.handlePlayerLeave(playerId);
  }

  /**
   * Cleans up room state and resources on destruction
   */
  destroy() {
    this.game.clearTimer();
    this.drawCommands = [];
    this.undoHistory = [];
    if (this.evolution && typeof this.evolution.destroy === "function") {
      this.evolution.destroy();
    }
    db.updateRoomRecord(this.id, {
      status: "closed",
      endedAt: Date.now()
    });
    this.onStateChange();
  }

  /**
   * Broadcasts a packet to all connected sockets in the room
   */
  broadcast(packet) {
    for (const player of this.players.values()) {
      if (!player.disconnected && player.socket) {
        player.socket.emit("data", packet);
      }
    }
  }

  /**
   * Broadcasts a custom event name to all connected sockets in the room
   */
  broadcastCustom(event, data) {
    for (const player of this.players.values()) {
      if (!player.disconnected && player.socket) {
        player.socket.emit(event, data);
      }
    }
  }

  /**
   * Broadcasts a packet to all connected sockets except sender
   */
  broadcastToOthers(senderSocket, packet) {
    for (const player of this.players.values()) {
      if (!player.disconnected && player.socket && player.socket !== senderSocket) {
        player.socket.emit("data", packet);
      }
    }
  }

  /**
   * Handles room setting updates by the host
   */
  updateSetting(settingIndex, value, senderPlayer) {
    if (senderPlayer.id !== this.ownerId) return;

    if (settingIndex === "category" || settingIndex === 8) {
      this.category = String(value || "Random").trim();
      this.broadcastCustom("evolution:category_changed", { category: this.category });
      db.updateRoomRecord(this.id, { category: this.category });
      this.onStateChange();
      return;
    }

    const sIdx = parseInt(settingIndex, 10);
    const parsedVal = (sIdx === SETTINGS.CUSTOMWORDSONLY)
      ? (value ? 1 : 0)
      : (isNaN(parseInt(value, 10)) ? value : parseInt(value, 10));

    this.settings[sIdx] = parsedVal;
    this.lastActivityAt = Date.now();
    this.broadcast({
      id: PACKETS.SETTINGS,
      data: { id: sIdx, val: parsedVal }
    });

    // If game mode changed, sync evolution state for all players
    if (sIdx === SETTINGS.WORDMODE) {
      for (const p of this.players.values()) {
        this.evolution.syncPlayerState(p);
      }
      db.updateRoomRecord(this.id, { gameMode: parsedVal === 6 ? "Evolution" : "Classic" });
    } else if (sIdx === SETTINGS.SLOTS) {
      db.updateRoomRecord(this.id, { maxPlayers: parsedVal });
    }

    this.onStateChange();
  }

  /**
   * Handles batch drawing strokes with bounds & payload validation
   */
  handleDrawing(senderPlayer, strokes) {
    if (this.game.state !== STATES.DRAWING || senderPlayer.id !== this.game.currentDrawerId) return;
    if (!Array.isArray(strokes) || strokes.length === 0) return;
    if (strokes.length > 60) return; // Reject excessive stroke bursts

    this.lastActivityAt = Date.now();

    // Sanitize and validate stroke commands
    const validStrokes = [];
    for (const s of strokes) {
      if (!Array.isArray(s) || s.length < 3) continue;
      const toolType = parseInt(s[0], 10); // 0: brush, 1: fill
      const color = Math.min(25, Math.max(0, parseInt(s[1], 10) || 0));

      if (toolType === 0) { // Brush stroke: [0, color, size, x1, y1, x2, y2]
        let size = Math.min(40, Math.max(4, parseInt(s[2], 10) || 4));
        if (this.evolution && this.evolution.isEvolutionMode()) {
          const drawerState = this.evolution.players.get(senderPlayer.id);
          if (drawerState && drawerState.buffs && drawerState.buffs.chaosBrushUntil > Date.now()) {
            size = 40; // Server-enforced max brush size under Chaos Brush
          }
        }
        const x1 = Math.min(2000, Math.max(-500, parseInt(s[3], 10) || 0));
        const y1 = Math.min(2000, Math.max(-500, parseInt(s[4], 10) || 0));
        const x2 = Math.min(2000, Math.max(-500, parseInt(s[5], 10) || 0));
        const y2 = Math.min(2000, Math.max(-500, parseInt(s[6], 10) || 0));
        validStrokes.push([0, color, size, x1, y1, x2, y2]);
      } else if (toolType === 1) { // Fill: [1, color, x, y]
        const x = Math.min(2000, Math.max(0, parseInt(s[2], 10) || 0));
        const y = Math.min(2000, Math.max(0, parseInt(s[3], 10) || 0));
        validStrokes.push([1, color, x, y]);
      }
    }

    if (validStrokes.length === 0) return;

    this.drawCommands.push(...validStrokes);
    this.broadcastToOthers(senderPlayer.socket, {
      id: PACKETS.DRAW,
      data: validStrokes
    });
  }

  /**
   * Handles canvas clear
   */
  handleClear(senderPlayer) {
    if (this.game.state !== STATES.DRAWING || senderPlayer.id !== this.game.currentDrawerId) return;

    this.lastActivityAt = Date.now();
    this.drawCommands = [];
    this.undoHistory = [];
    this.broadcast({
      id: PACKETS.CLEAR
    });
  }

  /**
   * Handles canvas stroke undo
   */
  handleUndo(senderPlayer, targetIndex) {
    if (this.game.state !== STATES.DRAWING || senderPlayer.id !== this.game.currentDrawerId) return;

    this.lastActivityAt = Date.now();
    if (typeof targetIndex === "number" && targetIndex >= 0) {
      this.drawCommands = this.drawCommands.slice(0, targetIndex);
      this.broadcast({
        id: PACKETS.UNDO,
        data: targetIndex
      });
    }
  }

  /**
   * Handles votekick request
   */
  handleVoteKick(voter, targetId) {
    if (targetId === this.ownerId) return; // Cannot votekick owner

    const target = this.players.get(targetId);
    if (!target) return;

    this.lastActivityAt = Date.now();
    voter.votedKick.add(targetId);

    // Count votes against target
    let voteCount = 0;
    for (const p of this.getActivePlayers()) {
      if (p.votedKick.has(targetId)) voteCount++;
    }

    const neededVotes = Math.floor(this.getActivePlayers().length / 2) + 1;

    // Broadcast votekick update (ba = 5)
    this.broadcast({
      id: PACKETS.VOTEKICK,
      data: [voter.id, targetId, voteCount, neededVotes]
    });

    if (voteCount >= neededVotes) {
      this.removePlayer(targetId, 1); // 1 = kicked
    }
  }

  /**
   * Broadcasts emoji reaction to room
   */
  handleEmote(player, emoji) {
    if (!emoji || typeof emoji !== "string") return;
    this.lastActivityAt = Date.now();
    this.broadcast({
      id: PACKETS.EMOTE,
      data: { id: player.id, emoji: emoji.slice(0, 10) }
    });
  }
}

module.exports = Room;
