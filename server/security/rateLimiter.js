/**
 * Security & Rate Limiting System for DrawRealm Production
 * Protects against WebSocket packet flooding, guess spamming, payload bombs, and malicious strings.
 */

const config = require("../config");

class RateLimiter {
  constructor() {
    this.socketLimits = new Map(); // socketId -> { draw: [timestamps], chat: [timestamps], action: [timestamps] }
    this.httpIpRequests = new Map(); // ip -> [timestamps]

    // Periodic cleanup of stale sockets every 60s
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, timestamps] of this.httpIpRequests.entries()) {
        const valid = timestamps.filter(t => now - t < 60000);
        if (valid.length === 0) this.httpIpRequests.delete(ip);
        else this.httpIpRequests.set(ip, valid);
      }
    }, 60000);
  }

  /**
   * Checks rate limit for a specific socket action type
   * @param {string} socketId 
   * @param {'draw' | 'chat' | 'action'} type 
   * @returns {boolean} true if permitted, false if rate limited
   */
  checkSocketRate(socketId, type = "action") {
    const now = Date.now();
    let entry = this.socketLimits.get(socketId);
    if (!entry) {
      entry = { draw: [], chat: [], action: [] };
      this.socketLimits.set(socketId, entry);
    }

    const list = entry[type] || [];
    // Keep timestamps from the last 1000ms
    const recent = list.filter(t => now - t < 1000);
    entry[type] = recent;

    let maxAllowed = config.RATE_LIMITS.ACTIONS_PER_SEC;
    if (type === "draw") maxAllowed = config.RATE_LIMITS.DRAW_PER_SEC;
    else if (type === "chat") maxAllowed = config.RATE_LIMITS.CHAT_PER_SEC;

    if (recent.length >= maxAllowed) {
      return false; // Rate limit exceeded
    }

    recent.push(now);
    return true;
  }

  /**
   * Clean socket state on disconnect
   */
  removeSocket(socketId) {
    this.socketLimits.delete(socketId);
  }

  /**
   * Express middleware for HTTP rate limiting
   */
  httpMiddleware(limitPerMinute = 120) {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const now = Date.now();
      let timestamps = this.httpIpRequests.get(ip) || [];

      // Filter timestamps older than 1 minute
      timestamps = timestamps.filter(t => now - t < 60000);

      if (timestamps.length >= limitPerMinute) {
        return res.status(429).json({
          error: "Too many requests. Please slow down."
        });
      }

      timestamps.push(now);
      this.httpIpRequests.set(ip, timestamps);
      next();
    };
  }

  /**
   * Validates that payload does not exceed maximum allowable size
   */
  validatePayloadSize(data, maxBytes = config.RATE_LIMITS.MAX_PAYLOAD_BYTES) {
    if (!data) return true;
    try {
      const str = typeof data === "string" ? data : JSON.stringify(data);
      return Buffer.byteLength(str, "utf8") <= maxBytes;
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes user input text (usernames, chat, custom words)
   */
  sanitizeText(text, maxLength = 100) {
    if (!text || typeof text !== "string") return "";
    return text
      .trim()
      .replace(/[<>]/g, "") // Remove direct HTML brackets to prevent XSS
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
      .slice(0, maxLength);
  }
}

const rateLimiter = new RateLimiter();
module.exports = rateLimiter;
