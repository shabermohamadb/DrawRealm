/**
 * Production Database Layer using Node.js native SQLite (node:sqlite)
 * Supports ACID transactions, WAL mode, player persistence, match records, and reconnect sessions.
 */

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const supabaseService = require("./supabaseClient");

class DatabaseManager {
  constructor(dbPath = config.DATABASE_URL) {
    this.dbPath = dbPath;
    this.init();
  }

  init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");

    // Initialize Schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        name TEXT PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        equipped_powers TEXT DEFAULT '[]',
        ultimate_power TEXT DEFAULT NULL,
        unlocked_powers TEXT DEFAULT '[]',
        achievements TEXT DEFAULT '[]',
        stats TEXT DEFAULT '{}',
        power_points INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        mode INTEGER NOT NULL,
        rounds INTEGER NOT NULL,
        winner_name TEXT,
        players_count INTEGER NOT NULL,
        final_scores TEXT NOT NULL,
        ended_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reconnect_sessions (
        token TEXT PRIMARY KEY,
        player_name TEXT NOT NULL,
        room_id TEXT NOT NULL,
        player_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reconnect_expires ON reconnect_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_matches_ended ON matches(ended_at);
    `);

    // Safe migration: Add power_points column if not present in existing table
    try {
      this.db.exec("ALTER TABLE players ADD COLUMN power_points INTEGER DEFAULT 0;");
    } catch (e) {
      // Column already exists
    }

    // Prepare commonly used statements
    this.stmtGetPlayer = this.db.prepare("SELECT * FROM players WHERE LOWER(name) = LOWER(?)");
    this.stmtUpsertPlayer = this.db.prepare(`
      INSERT INTO players (name, xp, level, equipped_powers, ultimate_power, unlocked_powers, achievements, stats, power_points, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        xp = excluded.xp,
        level = excluded.level,
        equipped_powers = excluded.equipped_powers,
        ultimate_power = excluded.ultimate_power,
        unlocked_powers = excluded.unlocked_powers,
        achievements = excluded.achievements,
        stats = excluded.stats,
        power_points = excluded.power_points,
        updated_at = excluded.updated_at
    `);

    this.stmtInsertMatch = this.db.prepare(`
      INSERT INTO matches (id, room_id, mode, rounds, winner_name, players_count, final_scores, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtGetRecentMatches = this.db.prepare("SELECT * FROM matches ORDER BY ended_at DESC LIMIT ?");

    this.stmtUpsertSession = this.db.prepare(`
      INSERT INTO reconnect_sessions (token, player_name, room_id, player_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        room_id = excluded.room_id,
        player_id = excluded.player_id,
        expires_at = excluded.expires_at
    `);

    this.stmtGetSession = this.db.prepare("SELECT * FROM reconnect_sessions WHERE token = ? AND expires_at > ?");
    this.stmtDeleteSession = this.db.prepare("DELETE FROM reconnect_sessions WHERE token = ?");
    this.stmtCleanExpiredSessions = this.db.prepare("DELETE FROM reconnect_sessions WHERE expires_at <= ?");

    // Migrate from legacy JSON if it exists
    this.migrateLegacyJson();
  }

  migrateLegacyJson() {
    const jsonPath = path.resolve(__dirname, "../data/evolution_profiles.json");
    if (!fs.existsSync(jsonPath)) return;

    try {
      const raw = fs.readFileSync(jsonPath, "utf8");
      const data = JSON.parse(raw);
      const count = Object.keys(data).length;
      if (count === 0) return;

      const now = Date.now();
      for (const [key, p] of Object.entries(data)) {
        const existing = this.stmtGetPlayer.get(p.name || key);
        if (!existing) {
          this.stmtUpsertPlayer.run(
            p.name || key,
            p.xp || 0,
            p.level || 0,
            JSON.stringify(p.equippedPowers || []),
            p.ultimatePower || null,
            JSON.stringify(p.unlockedPowers || []),
            JSON.stringify(p.achievements || []),
            JSON.stringify(p.stats || {}),
            now,
            now
          );
        }
      }
      console.log(`[Database] Migrated ${count} player profiles from legacy JSON storage.`);
    } catch (err) {
      console.warn("[Database] Migration from legacy JSON skipped or error:", err.message);
    }
  }

  getPlayer(name) {
    const cleanName = (name || "Player").trim();
    const row = this.stmtGetPlayer.get(cleanName);
    const now = Date.now();

    if (!row) {
      const defaultProfile = {
        name: cleanName,
        xp: 0,
        level: 0,
        equippedPowers: [],
        ultimatePower: null,
        unlockedPowers: [],
        achievements: [],
        stats: {
          fastGuesses: 0,
          successfulDraws: 0,
          shieldsUsed: 0,
          chaosUsed: 0,
          ultimatesUsed: 0,
          matchesWon: 0,
          roundsWon: 0,
          highestStreak: 0
        },
        powerPoints: 0
      };

      this.stmtUpsertPlayer.run(
        cleanName,
        defaultProfile.xp,
        defaultProfile.level,
        JSON.stringify(defaultProfile.equippedPowers),
        defaultProfile.ultimatePower,
        JSON.stringify(defaultProfile.unlockedPowers),
        JSON.stringify(defaultProfile.achievements),
        JSON.stringify(defaultProfile.stats),
        defaultProfile.powerPoints,
        now,
        now
      );

      return defaultProfile;
    }

    return {
      name: row.name,
      xp: row.xp,
      level: row.level,
      equippedPowers: JSON.parse(row.equipped_powers || "[]"),
      ultimatePower: row.ultimate_power || null,
      unlockedPowers: JSON.parse(row.unlocked_powers || "[]"),
      achievements: JSON.parse(row.achievements || "[]"),
      stats: JSON.parse(row.stats || "{}"),
      powerPoints: row.power_points !== undefined && row.power_points !== null ? row.power_points : 0
    };
  }

  savePlayer(name, profile) {
    const cleanName = (name || profile.name || "Player").trim();
    const now = Date.now();

    this.stmtUpsertPlayer.run(
      cleanName,
      profile.xp || 0,
      profile.level || 0,
      JSON.stringify(profile.equippedPowers || []),
      profile.ultimatePower || null,
      JSON.stringify(profile.unlockedPowers || []),
      JSON.stringify(profile.achievements || []),
      JSON.stringify(profile.stats || {}),
      profile.powerPoints || 0,
      now,
      now
    );

    // Asynchronously synchronize with Supabase PostgreSQL
    if (supabaseService.isConfigured) {
      this.syncPlayerToSupabase(cleanName, profile);
    }

    return profile;
  }

  syncPlayerToSupabase(cleanName, profile) {
    supabaseService.getOrCreatePlayer(cleanName).then(remote => {
      if (remote && remote.id) {
        profile.profileId = remote.id;
        supabaseService.saveEvolutionState(remote.id, {
          xp: profile.xp,
          level: profile.level,
          powerPoints: profile.powerPoints || 0,
          ultimatePower: profile.ultimatePower,
          unlockedPowers: profile.unlockedPowers,
          equippedPowers: profile.equippedPowers
        }).catch(err => {
          console.warn(`[Database] Supabase evolution sync failed for ${cleanName}:`, err.message);
        });

        // Sync achievements if any
        if (Array.isArray(profile.achievements)) {
          for (const ach of profile.achievements) {
            const achId = typeof ach === "string" ? ach : (ach.id || ach.achievement_id);
            if (achId) {
              supabaseService.unlockAchievement(remote.id, achId).catch(() => {});
            }
          }
        }
      }
    }).catch(err => {
      console.warn(`[Database] Supabase getOrCreatePlayer failed for ${cleanName}:`, err.message);
    });
  }

  saveMatch({ id, roomId, mode, rounds, winnerId, winnerName, playersCount, playerCount, finalScores, data, durationSeconds }) {
    const matchId = id || `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const scores = finalScores || (data && data.players) || [];
    this.stmtInsertMatch.run(
      matchId,
      roomId || "room",
      typeof mode === "number" ? mode : 0,
      rounds || 3,
      winnerName || "Nobody",
      playerCount || playersCount || 0,
      JSON.stringify(scores),
      Date.now()
    );

    // Asynchronously record match to Supabase PostgreSQL
    if (supabaseService.isConfigured) {
      const playersList = (data && Array.isArray(data.players)) ? data.players : [];
      const supabasePlayers = playersList.map(p => ({
        playerId: p.profileId,
        score: p.score || 0,
        xpEarned: (p.matchXpEarned !== undefined ? p.matchXpEarned : (p.xpEarned || 0)),
        powerPointsEarned: (p.matchPpEarned !== undefined ? p.matchPpEarned : (p.powerPointsEarned || 0)),
        position: p.position || 1,
        correctGuesses: p.guessedCount || 0,
        roundsPlayed: rounds || 3
      }));

      supabaseService.recordMatch({
        roomId: roomId || "room",
        mode: typeof mode === "string" ? mode : "classic",
        startedAt: new Date(Date.now() - (durationSeconds ? durationSeconds * 1000 : 60000)).toISOString(),
        endedAt: new Date().toISOString(),
        winnerId: (winnerId && winnerId.length === 36) ? winnerId : null,
        players: supabasePlayers
      }).catch(err => {
        console.warn("[Database] Failed to record match in Supabase:", err.message);
      });
    }

    return matchId;
  }

  getRecentMatches(limit = 20) {
    const rows = this.stmtGetRecentMatches.all(limit);
    return rows.map(r => ({
      id: r.id,
      roomId: r.room_id,
      mode: r.mode,
      rounds: r.rounds,
      winnerName: r.winner_name,
      playersCount: r.players_count,
      finalScores: JSON.parse(r.final_scores || "[]"),
      endedAt: r.ended_at
    }));
  }

  createReconnectSession(token, playerName, roomId, playerId, ttlMs = config.RECONNECT_GRACE_PERIOD_MS) {
    const expiresAt = Date.now() + ttlMs;
    this.stmtUpsertSession.run(token, playerName, roomId, playerId, expiresAt);
    return { token, expiresAt };
  }

  getReconnectSession(token) {
    if (!token) return null;
    const row = this.stmtGetSession.get(token, Date.now());
    if (!row) return null;
    return {
      token: row.token,
      playerName: row.player_name,
      roomId: row.room_id,
      playerId: row.player_id,
      expiresAt: row.expires_at
    };
  }

  deleteReconnectSession(token) {
    if (token) {
      this.stmtDeleteSession.run(token);
    }
  }

  cleanupExpiredSessions() {
    this.stmtCleanExpiredSessions.run(Date.now());
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

const dbManager = new DatabaseManager();
module.exports = dbManager;
