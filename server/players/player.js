/**
 * Player model representing a user in a room
 */

const crypto = require("crypto");
const { isValidAccessoryId } = require("../utils/accessoriesCatalog");

class Player {
  /**
   * Validates and normalizes avatar data.
   * Supports:
   * 1. 6-tuple array: [color, eyes, mouth, special, accessoryId, accessoryVariant]
   * 2. 4-tuple array: [color, eyes, mouth, special] (legacy, accessory defaults to "")
   * 3. Object shape: { characterId, eyes, mouth, special, accessoryId, accessoryVariant }
   * Enforces strict validation: rejects invalid types, NaN, out-of-bounds, path traversal, unknown accessory IDs.
   */
  static validateAvatar(avatar) {
    const valid = [0, 0, 0, -1, "", 0];
    if (Array.isArray(avatar)) {
      valid[0] = Number.isInteger(avatar[0]) ? Math.abs(avatar[0]) : 0;
      valid[1] = Number.isInteger(avatar[1]) ? Math.abs(avatar[1]) : 0;
      valid[2] = Number.isInteger(avatar[2]) ? Math.abs(avatar[2]) : 0;
      valid[3] = Number.isInteger(avatar[3]) ? avatar[3] : -1;
      const accId = typeof avatar[4] === "string" ? avatar[4].trim() : "";
      valid[4] = isValidAccessoryId(accId) ? accId : "";
      valid[5] = Number.isInteger(avatar[5]) ? Math.abs(avatar[5]) : 0;
    } else if (avatar && typeof avatar === "object") {
      valid[0] = Number.isInteger(avatar.characterId || avatar.color) ? Math.abs(avatar.characterId || avatar.color) : 0;
      valid[1] = Number.isInteger(avatar.eyes) ? Math.abs(avatar.eyes) : 0;
      valid[2] = Number.isInteger(avatar.mouth) ? Math.abs(avatar.mouth) : 0;
      valid[3] = Number.isInteger(avatar.special) ? avatar.special : -1;
      const accId = typeof (avatar.accessoryId || avatar.accessory) === "string" ? (avatar.accessoryId || avatar.accessory).trim() : "";
      valid[4] = isValidAccessoryId(accId) ? accId : "";
      valid[5] = Number.isInteger(avatar.accessoryVariant || avatar.variant) ? Math.abs(avatar.accessoryVariant || avatar.variant) : 0;
    }
    return valid;
  }

  /**
   * @param {Object} options
   * @param {number} options.id - Room-unique player ID
   * @param {Object} options.socket - Socket.IO socket
   * @param {string} options.name - Player username
   * @param {Array<number|string>} options.avatar - Avatar tuple [color, eyes, mouth, special, accessoryId, accessoryVariant]
   * @param {number} [options.flags] - Admin/moderation flags (4 = admin)
   * @param {boolean} [options.spectator] - Whether player is spectator
   * @param {string} [options.team] - Assigned team ('red' or 'blue')
   * @param {string} [options.reconnectToken] - Optional existing reconnection token
   * @param {string} [options.roomId] - Active room ID
   */
  constructor({ id, socket, name, avatar, flags = 0, spectator = false, team = "", reconnectToken = null, roomId = null }) {
    this.id = id;
    this.socket = socket;
    const trimmedName = (name && typeof name === "string") ? name.trim().slice(0, 20) : "";
    if (!trimmedName || trimmedName.length < 2) {
      throw new Error("Valid player name (at least 2 characters) is required");
    }
    this.name = trimmedName;
    this.avatar = Player.validateAvatar(avatar);
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
    this.matchXpEarned = 0;
    this.matchPpEarned = 0;
    this.guessedCount = 0;
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
    this.guessedCount = 0;
    this.matchXpEarned = 0;
    this.matchPpEarned = 0;
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
