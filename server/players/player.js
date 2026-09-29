/**
 * Player model representing a user in a room
 */

const crypto = require("crypto");

class Player {
  /**
   * @param {Object} options
   * @param {number} options.id - Room-unique player ID
   * @param {Object} options.socket - Socket.IO socket
   * @param {string} options.name - Player username
   * @param {Array<number>} options.avatar - Avatar tuple [color, eyes, mouth, special]
   * @param {number} [options.flags] - Admin/moderation flags (4 = admin)
   * @param {boolean} [options.spectator] - Whether player is spectator
   * @param {string} [options.team] - Assigned team ('red' or 'blue')
   * @param {string} [options.reconnectToken] - Optional existing reconnection token
   */
  constructor({ id, socket, name, avatar, flags = 0, spectator = false, team = "", reconnectToken = null }) {
    this.id = id;
    this.socket = socket;
    this.name = (name && name.trim().length > 0) ? name.trim().slice(0, 20) : `Player ${id}`;
    this.avatar = (Array.isArray(avatar) && avatar.length === 4) ? avatar : [0, 0, 0, -1];
    this.score = 0;
    this.guessed = false;
    this.guessTime = 0;
    this.flags = flags;
    this.spectator = !!spectator;
    this.team = team || (id % 2 === 0 ? "blue" : "red");
    this.muted = false;
    this.reported = false;
    this.votedKick = new Set();
    this.ip = socket && socket.handshake ? socket.handshake.address : "unknown";
    this.disconnected = false;
    this.disconnectedAt = 0;
    this.disconnectTimeout = null;
    this.reconnectToken = reconnectToken || crypto.randomUUID();
    this.profileId = null;
  }

  /**
   * Resets turn-specific state for a new drawing turn
   */
  resetTurn() {
    this.guessed = false;
    this.guessTime = 0;
  }

  /**
   * Resets game-wide state for a new game
   */
  resetGame() {
    this.score = 0;
    this.guessed = false;
    this.guessTime = 0;
  }

  /**
   * Serializes player data to the format expected by the frontend (packet 1 and 10)
   */
  toJSON() {
    return {
      id: this.id,
      flags: this.flags,
      name: this.name,
      avatar: this.avatar,
      score: this.score,
      guessed: this.guessed,
      spectator: this.spectator,
      team: this.team
    };
  }
}

module.exports = Player;
