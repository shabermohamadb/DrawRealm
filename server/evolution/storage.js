/**
 * Persistent Storage Adapter for Evolution Profiles
 * Powered by production DatabaseManager (node:sqlite)
 */

const db = require("../db/database");

class EvolutionStorage {
  constructor() {
    this.profiles = new Map(); // playerName -> profile
  }

  getProfile(playerName) {
    if (!this.profiles.has(playerName)) {
      const profile = db.getPlayer(playerName);
      this.profiles.set(playerName, profile);
    }
    return this.profiles.get(playerName);
  }

  save() {
    for (const [name, profile] of this.profiles.entries()) {
      try {
        db.savePlayer(name, profile);
      } catch (err) {
        console.error(`[EvolutionStorage] Failed to save profile for ${name}:`, err.message);
      }
    }
  }

  updateProfile(playerName, updates) {
    const profile = this.getProfile(playerName);
    Object.assign(profile, updates);
    this.save();
    return profile;
  }
}

module.exports = new EvolutionStorage();
