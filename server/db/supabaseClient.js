/**
 * Privileged Server-Side Supabase Client for DrawRealm
 * Provides resilient, server-authoritative persistence for:
 * - Player Profiles
 * - Player Statistics
 * - Evolution Progression (XP, Level, Powers, Loadouts)
 * - Idempotent Achievements
 * - Completed Match History & Results
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

class SupabaseService {
  constructor() {
    this.client = null;
    this.isConfigured = false;
    this.tableSupport = {
      player_powers: true,
      equipped_powers: true,
      achievements: true,
      matches: true,
      match_players: true,
      match_rounds: true
    };
    this.init();
  }

  init() {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Operating in offline/local mode.");
      this.isConfigured = false;
      return;
    }

    try {
      this.client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      this.isConfigured = true;
      console.log(`[Supabase] Initialized client for project ${config.SUPABASE_URL}`);
    } catch (err) {
      console.error("[Supabase] Failed to initialize client:", err.message);
      this.isConfigured = false;
    }
  }

  /**
   * Health check to test connectivity to Supabase
   */
  async healthCheck() {
    if (!this.isConfigured || !this.client) {
      return { status: "not_configured", latencyMs: 0 };
    }
    const start = Date.now();
    try {
      const { error } = await this.client.from("profiles").select("id").limit(1);
      const latencyMs = Date.now() - start;
      if (error) {
        return { status: "error", error: error.message, latencyMs };
      }
      return { status: "connected", latencyMs };
    } catch (err) {
      return { status: "error", error: err.message, latencyMs: Date.now() - start };
    }
  }

  /**
   * Retrieves an existing player or creates a complete default profile
   */
  async getOrCreatePlayer(username, displayName) {
    if (!this.isConfigured || !this.client) return null;

    const cleanUsername = String(username || "Player").trim().slice(0, 30);
    const cleanDisplay = String(displayName || cleanUsername).trim().slice(0, 50);

    try {
      // 1. Check if profile exists
      let { data: profiles, error } = await this.client
        .from("profiles")
        .select("*")
        .eq("username", cleanUsername)
        .limit(1);

      if (error) {
        console.error(`[Supabase] Error looking up profile for ${cleanUsername}:`, error.message);
        return null;
      }

      let profile = profiles && profiles.length > 0 ? profiles[0] : null;

      // 2. If not found, create new profile
      if (!profile) {
        const { data: created, error: createErr } = await this.client
          .from("profiles")
          .insert({
            username: cleanUsername,
            display_name: cleanDisplay,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_active_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createErr) {
          // If concurrent insert occurred, retry fetch
          if (createErr.code === "23505") {
            const { data: retryProfiles } = await this.client
              .from("profiles")
              .select("*")
              .eq("username", cleanUsername)
              .limit(1);
            profile = retryProfiles && retryProfiles[0];
          } else {
            console.error(`[Supabase] Failed to create profile for ${cleanUsername}:`, createErr.message);
            return null;
          }
        } else {
          profile = created;
          console.log(`[Supabase] Created new profile for ${cleanUsername} (UUID: ${profile.id})`);
        }

        // Initialize default stats
        if (profile) {
          try {
            await this.client.from("player_stats").insert({
              player_id: profile.id,
              games_played: 0,
              games_won: 0,
              rounds_played: 0,
              correct_guesses: 0,
              best_score: 0,
              current_streak: 0,
              highest_streak: 0
            });
          } catch (e) {}

          // Initialize default evolution profile
          try {
            await this.client.from("evolution_profiles").insert({
              player_id: profile.id,
              xp: 0,
              level: 0,
              branch: "balanced",
              ultimate_power: null,
              updated_at: new Date().toISOString()
            });
          } catch (e) {}
        }
      } else {
        // Update last_active_at
        try {
          await this.client
            .from("profiles")
            .update({ last_active_at: new Date().toISOString() })
            .eq("id", profile.id);
        } catch (e) {}
      }

      if (!profile) return null;

      // 3. Fetch related player stats & evolution profile in parallel
      const [statsRes, evoRes] = await Promise.all([
        this.client.from("player_stats").select("*").eq("player_id", profile.id).maybeSingle(),
        this.client.from("evolution_profiles").select("*").eq("player_id", profile.id).maybeSingle()
      ]);

      const stats = statsRes.data || {
        games_played: 0,
        games_won: 0,
        rounds_played: 0,
        correct_guesses: 0,
        best_score: 0,
        current_streak: 0,
        highest_streak: 0
      };

      const evo = evoRes.data || {
        xp: 0,
        level: 0,
        branch: "balanced",
        ultimate_power: null
      };

      // 4. Fetch supplementary powers & achievements if tables are available
      let unlockedPowers = [];
      let equippedPowers = [];
      let achievements = [];

      if (this.tableSupport.player_powers) {
        const { data: powers, error: powErr } = await this.client
          .from("player_powers")
          .select("power_id")
          .eq("player_id", profile.id);
        if (powErr) {
          if (powErr.code === "PGRST205") this.tableSupport.player_powers = false;
        } else if (powers) {
          unlockedPowers = powers.map(p => p.power_id);
        }
      }

      if (this.tableSupport.equipped_powers) {
        const { data: equipped, error: eqErr } = await this.client
          .from("equipped_powers")
          .select("slot, power_id")
          .eq("player_id", profile.id)
          .order("slot", { ascending: true });
        if (eqErr) {
          if (eqErr.code === "PGRST205") this.tableSupport.equipped_powers = false;
        } else if (equipped) {
          equippedPowers = equipped.map(e => e.power_id);
        }
      }

      if (this.tableSupport.achievements) {
        const { data: achs, error: achErr } = await this.client
          .from("achievements")
          .select("achievement_id")
          .eq("player_id", profile.id);
        if (achErr) {
          if (achErr.code === "PGRST205") this.tableSupport.achievements = false;
        } else if (achs) {
          achievements = achs.map(a => a.achievement_id);
        }
      }

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        createdAt: profile.created_at,
        lastActiveAt: profile.last_active_at,
        stats,
        evolution: {
          xp: evo.xp,
          level: evo.level,
          branch: evo.branch || "balanced",
          ultimatePower: evo.ultimate_power || null,
          unlockedPowers,
          equippedPowers,
          achievements
        }
      };
    } catch (err) {
      console.error(`[Supabase] Exception in getOrCreatePlayer for ${cleanUsername}:`, err.message);
      return null;
    }
  }

  /**
   * Persists Evolution progression updates (XP, level, powers)
   */
  async saveEvolutionState(playerId, state = {}) {
    if (!this.isConfigured || !this.client || !playerId) return false;

    try {
      const evoUpdates = {
        updated_at: new Date().toISOString()
      };
      if (typeof state.xp === "number") evoUpdates.xp = state.xp;
      if (typeof state.level === "number") evoUpdates.level = state.level;
      if (typeof state.powerPoints === "number") evoUpdates.power_points = state.powerPoints;
      if (state.branch) evoUpdates.branch = state.branch;
      if (state.ultimatePower !== undefined) evoUpdates.ultimate_power = state.ultimatePower;

      // Upsert evolution profile
      await this.client
        .from("evolution_profiles")
        .upsert({
          player_id: playerId,
          ...evoUpdates
        }, { onConflict: "player_id" });

      // Persist unlocked powers if table is available
      if (this.tableSupport.player_powers && Array.isArray(state.unlockedPowers) && state.unlockedPowers.length > 0) {
        const powerRows = state.unlockedPowers.map(pId => ({
          player_id: playerId,
          power_id: pId,
          rarity: "common",
          unlocked_at: new Date().toISOString()
        }));

        const { error: powErr } = await this.client
          .from("player_powers")
          .upsert(powerRows, { onConflict: "player_id,power_id", ignoreDuplicates: true });

        if (powErr && powErr.code === "PGRST205") {
          this.tableSupport.player_powers = false;
        }
      }

      // Persist equipped powers if table is available
      if (this.tableSupport.equipped_powers && Array.isArray(state.equippedPowers)) {
        const equippedRows = state.equippedPowers
          .filter(pId => pId && typeof pId === "string")
          .map((pId, slot) => ({
            player_id: playerId,
            slot,
            power_id: pId
          }));

        if (equippedRows.length > 0) {
          const { error: eqErr } = await this.client
            .from("equipped_powers")
            .upsert(equippedRows, { onConflict: "player_id,slot" });

          if (eqErr && eqErr.code === "PGRST205") {
            this.tableSupport.equipped_powers = false;
          }
        }
      }

      return true;
    } catch (err) {
      console.error(`[Supabase] Exception in saveEvolutionState for player ${playerId}:`, err.message);
      return false;
    }
  }

  /**
   * Idempotently unlocks an achievement for a player
   */
  async unlockAchievement(playerId, achievementId) {
    if (!this.isConfigured || !this.client || !playerId || !achievementId) return false;
    if (!this.tableSupport.achievements) return false;

    try {
      const { error } = await this.client
        .from("achievements")
        .upsert({
          player_id: playerId,
          achievement_id: achievementId,
          unlocked_at: new Date().toISOString()
        }, { onConflict: "player_id,achievement_id", ignoreDuplicates: true });

      if (error) {
        if (error.code === "PGRST205") this.tableSupport.achievements = false;
        else console.error(`[Supabase] Failed to unlock achievement ${achievementId}:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[Supabase] Exception unlocking achievement ${achievementId}:`, err.message);
      return false;
    }
  }

  /**
   * Records completed match data and updates participant statistics
   */
  async recordMatch(matchData = {}) {
    if (!this.isConfigured || !this.client) return null;

    try {
      const {
        roomId,
        mode = "classic",
        startedAt,
        endedAt = new Date().toISOString(),
        winnerId,
        players = []
      } = matchData;

      let matchId = null;

      // 1. Insert into matches table if available
      if (this.tableSupport.matches) {
        const { data: match, error: matchErr } = await this.client
          .from("matches")
          .insert({
            room_id: roomId || "room",
            game_mode: mode,
            started_at: startedAt || new Date().toISOString(),
            ended_at: endedAt,
            winner_id: winnerId || null
          })
          .select("id")
          .single();

        if (matchErr) {
          if (matchErr.code === "PGRST205") this.tableSupport.matches = false;
          else console.error("[Supabase] Failed to insert match:", matchErr.message);
        } else if (match) {
          matchId = match.id;
        }
      }

      // 2. Insert into match_players if available
      if (matchId && this.tableSupport.match_players && players.length > 0) {
        const participantRows = players
          .filter(p => p.playerId)
          .map(p => ({
            match_id: matchId,
            player_id: p.playerId,
            score: p.score || 0,
            evolution_xp_earned: p.xpEarned || 0,
            final_position: p.position || 1
          }));

        if (participantRows.length > 0) {
          const { error: partErr } = await this.client
            .from("match_players")
            .insert(participantRows);

          if (partErr && partErr.code === "PGRST205") {
            this.tableSupport.match_players = false;
          }
        }
      }

      // 3. Update player_stats for each participant safely
      for (const p of players) {
        if (!p.playerId) continue;

        try {
          const { data: currentStats } = await this.client
            .from("player_stats")
            .select("*")
            .eq("player_id", p.playerId)
            .maybeSingle();

          const prev = currentStats || {
            games_played: 0,
            games_won: 0,
            rounds_played: 0,
            correct_guesses: 0,
            best_score: 0,
            current_streak: 0,
            highest_streak: 0
          };

          const isWinner = p.playerId === winnerId;
          const newGamesPlayed = prev.games_played + 1;
          const newGamesWon = prev.games_won + (isWinner ? 1 : 0);
          const newBestScore = Math.max(prev.best_score || 0, p.score || 0);
          const newCorrectGuesses = (prev.correct_guesses || 0) + (p.correctGuesses || 0);
          const newStreak = p.streak || 0;
          const newHighestStreak = Math.max(prev.highest_streak || 0, newStreak);

          await this.client
            .from("player_stats")
            .upsert({
              player_id: p.playerId,
              games_played: newGamesPlayed,
              games_won: newGamesWon,
              rounds_played: prev.rounds_played + (p.roundsPlayed || 1),
              correct_guesses: newCorrectGuesses,
              best_score: newBestScore,
              current_streak: newStreak,
              highest_streak: newHighestStreak
            }, { onConflict: "player_id" });
        } catch (statsErr) {
          console.error(`[Supabase] Failed to update stats for player ${p.playerId}:`, statsErr.message);
        }
      }

      return matchId;
    } catch (err) {
      console.error("[Supabase] Exception in recordMatch:", err.message);
      return null;
    }
  }

  async createRoomRecord(roomData) {
    if (!this.isConfigured || !this.client) return null;
    try {
      const { data, error } = await this.client
        .from("rooms")
        .upsert({
          id: roomData.id,
          room_code: roomData.roomCode || roomData.id,
          room_type: roomData.roomType || "public",
          host_player_id: roomData.hostPlayerId ? String(roomData.hostPlayerId) : null,
          game_mode: roomData.gameMode || "Classic",
          category: roomData.category || "Random",
          status: roomData.status || "waiting",
          max_players: roomData.maxPlayers || 8,
          created_at: roomData.createdAt || new Date().toISOString()
        }, { onConflict: "id" });
      if (error && !error.message.includes("does not exist") && !error.message.includes("relation")) {
        console.warn("[Supabase] createRoomRecord error:", error.message);
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  async updateRoomRecord(id, updates) {
    if (!this.isConfigured || !this.client) return null;
    try {
      const payload = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.startedAt !== undefined) payload.started_at = new Date(updates.startedAt).toISOString();
      if (updates.endedAt !== undefined) payload.ended_at = new Date(updates.endedAt).toISOString();
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.gameMode !== undefined) payload.game_mode = updates.gameMode;
      if (updates.maxPlayers !== undefined) payload.max_players = updates.maxPlayers;
      if (updates.hostPlayerId !== undefined) payload.host_player_id = updates.hostPlayerId ? String(updates.hostPlayerId) : null;

      const { data, error } = await this.client
        .from("rooms")
        .update(payload)
        .eq("id", id);
      if (error && !error.message.includes("does not exist") && !error.message.includes("relation")) {
        console.warn("[Supabase] updateRoomRecord error:", error.message);
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  async addRoomPlayer({ roomId, playerId, playerName, role }) {
    if (!this.isConfigured || !this.client) return null;
    try {
      const { data, error } = await this.client
        .from("room_players")
        .upsert({
          room_id: roomId,
          player_id: String(playerId),
          player_name: playerName,
          role: role || "player",
          joined_at: new Date().toISOString(),
          is_active: true
        });
      return data;
    } catch (err) {
      return null;
    }
  }

  async updateRoomPlayerLeft({ roomId, playerId, leftAt }) {
    if (!this.isConfigured || !this.client) return null;
    try {
      const { data, error } = await this.client
        .from("room_players")
        .update({
          is_active: false,
          left_at: leftAt || new Date().toISOString()
        })
        .match({ room_id: roomId, player_id: String(playerId) });
      return data;
    } catch (err) {
      return null;
    }
  }
}

const supabaseService = new SupabaseService();
module.exports = supabaseService;
