/**
 * Room-level Evolution Mode Manager
 * Authoritative Server Power Engine
 */

const { EVOLUTION_LEVELS, EVOLUTION_XP, POWER_POINTS_REWARDS, POWER_COSTS } = require("./config");
const { POWERS, rollDraftChoices } = require("./powers");
const { checkAchievements } = require("./achievements");
const storage = require("./storage");

class EvolutionManager {
  constructor(room) {
    this.room = room;
    this.players = new Map(); // playerId -> state
    this.lastActionTimes = new Map(); // playerId -> timestamp (anti-spam)
    this.processedRequestIds = new Map(); // requestId -> timestamp (idempotency)
    this.activeRoomModifiers = new Map(); // key -> { expiresAt, data }
    this.pointBomb = null; // { active: bool, expiresAt: number, placedBy: number }
  }

  isEvolutionMode() {
    return parseInt(this.room.settings[6]) === 6;
  }

  /**
   * Initializes or loads evolution state for a player
   */
  initPlayer(player) {
    const profile = storage.getProfile(player.name);
    
    // Calculate level based on XP
    let level = 0;
    for (let i = EVOLUTION_LEVELS.length - 1; i >= 0; i--) {
      if (profile.xp >= EVOLUTION_LEVELS[i].xpRequired) {
        level = EVOLUTION_LEVELS[i].level;
        break;
      }
    }
    profile.level = level;
    if (profile.powerPoints === undefined || profile.powerPoints === null) {
      profile.powerPoints = 0;
    }

    // Ensure all equipped powers are stored in unlockedPowers
    for (const p of profile.equippedPowers) {
      if (!profile.unlockedPowers.includes(p)) {
        profile.unlockedPowers.push(p);
      }
    }
    if (profile.ultimatePower && !profile.unlockedPowers.includes(profile.ultimatePower)) {
      profile.unlockedPowers.push(profile.ultimatePower);
    }

    // Default basic power for level >= 1 if none equipped
    if (level >= 1 && profile.equippedPowers.length === 0) {
      profile.equippedPowers.push("score_surge");
      if (!profile.unlockedPowers.includes("score_surge")) {
        profile.unlockedPowers.push("score_surge");
      }
    }

    // Initialize usesRemaining map for limited powers
    const usesRemaining = new Map();
    for (const pId of profile.equippedPowers) {
      if (POWERS[pId] && POWERS[pId].maxUses !== null) {
        usesRemaining.set(pId, POWERS[pId].maxUses);
      }
    }
    if (profile.ultimatePower && POWERS[profile.ultimatePower] && POWERS[profile.ultimatePower].maxUses !== null) {
      usesRemaining.set(profile.ultimatePower, POWERS[profile.ultimatePower].maxUses);
    }

    const state = {
      playerId: player.id,
      name: player.name,
      xp: profile.xp,
      level: level,
      powerPoints: profile.powerPoints || 0,
      equippedPowers: [...profile.equippedPowers],
      ultimatePower: profile.ultimatePower,
      cooldowns: new Map(), // powerId -> expiresAt
      usesRemaining: usesRemaining, // powerId -> remainingCount
      streak: 0,
      buffs: {
        scoreSurge: false,
        doubleStrike: 0,
        bullseye: false,
        shield: false,
        scoreLockUntil: 0,
        freezeGuardUntil: 0,
        ghostGuess: false,
        secondThought: false,
        colorBurstUntil: 0,
        shapeAssist: false,
        magicBrushUntil: 0,
        trailBrushUntil: 0,
        overdrive: false
      },
      pendingDraft: rollDraftChoices(level, null, profile.unlockedPowers || [])
    };

    this.players.set(player.id, state);
    this.syncPlayerState(player);
    return state;
  }

  getPlayerState(playerId) {
    return this.players.get(playerId);
  }

  /**
   * Sends current evolution state to a specific player
   */
  syncPlayerState(player) {
    const state = this.players.get(player.id);
    if (!state || !player.socket) return;

    const nextLevelData = EVOLUTION_LEVELS[Math.min(state.level + 1, EVOLUTION_LEVELS.length - 1)];
    const currentLevelData = EVOLUTION_LEVELS[state.level];
    const profile = storage.getProfile(player.name);

    // Format cooldowns as remaining seconds and absolute timestamps
    const now = Date.now();
    const cooldownsObj = {};
    const cooldownEndsAtObj = {};
    for (const [pId, exp] of state.cooldowns.entries()) {
      if (exp > now) {
        cooldownsObj[pId] = Math.ceil((exp - now) / 1000);
        cooldownEndsAtObj[pId] = exp;
      }
    }

    // Format uses remaining
    const usesRemainingObj = {};
    for (const [pId, count] of state.usesRemaining.entries()) {
      usesRemainingObj[pId] = count;
    }

    const payload = {
      playerId: player.id,
      isEvolutionMode: this.isEvolutionMode(),
      level: state.level,
      title: currentLevelData.title,
      xp: state.xp,
      currentLevelXp: currentLevelData.xpRequired,
      nextLevelXp: nextLevelData.xpRequired,
      maxPowers: currentLevelData.maxPowers || 0,
      hasUltimate: !!currentLevelData.hasUltimate,
      equippedPowers: state.equippedPowers.map(pId => POWERS[pId] || null).filter(Boolean),
      ultimatePower: state.ultimatePower ? (POWERS[state.ultimatePower] || null) : null,
      unlockedPowers: (profile.unlockedPowers || []).map(pId => POWERS[pId] || null).filter(Boolean),
      cooldowns: cooldownsObj,
      cooldownEndsAt: cooldownEndsAtObj,
      usesRemaining: usesRemainingObj,
      streak: state.streak,
      powerPoints: state.powerPoints || 0,
      buffs: {
        scoreSurge: state.buffs.scoreSurge,
        doubleStrike: state.buffs.doubleStrike,
        bullseye: state.buffs.bullseye,
        shield: state.buffs.shield,
        scoreLock: state.buffs.scoreLockUntil > now,
        freezeGuard: state.buffs.freezeGuardUntil > now,
        ghostGuess: state.buffs.ghostGuess,
        secondThought: state.buffs.secondThought,
        colorBurst: state.buffs.colorBurstUntil > now,
        shapeAssist: state.buffs.shapeAssist,
        magicBrush: state.buffs.magicBrushUntil > now,
        trailBrush: state.buffs.trailBrushUntil > now,
        overdrive: state.buffs.overdrive
      },
      pendingDraft: state.pendingDraft,
      availableDraft: state.pendingDraft
    };

    player.socket.emit("evolution:state", payload);

    // Also broadcast public player evolution badges to room
    this.broadcastRosterEvolution();
  }

  broadcastRosterEvolution() {
    const roster = [];
    for (const [pId, state] of this.players.entries()) {
      roster.push({
        id: pId,
        level: state.level,
        title: EVOLUTION_LEVELS[state.level].title,
        streak: state.streak
      });
    }
    this.room.broadcastCustom("evolution:roster", roster);
  }

  /**
   * Awards XP to player, handles level up and profile persistence
   */
  addXP(player, amount, reason = "") {
    if (!this.isEvolutionMode()) return;
    const state = this.players.get(player.id);
    if (!state) return;

    state.xp += amount;
    const oldLevel = state.level;

    // Check level progression
    let newLevel = oldLevel;
    for (let i = EVOLUTION_LEVELS.length - 1; i >= 0; i--) {
      if (state.xp >= EVOLUTION_LEVELS[i].xpRequired) {
        newLevel = EVOLUTION_LEVELS[i].level;
        break;
      }
    }

    // Persist to storage
    const profile = storage.getProfile(player.name);
    profile.xp = state.xp;
    profile.level = newLevel;

    // Notify XP gain
    if (player.socket) {
      player.socket.emit("evolution:xp_gain", {
        amount,
        totalXp: state.xp,
        reason
      });
    }

    // Handle Level Up
    if (newLevel > oldLevel) {
      state.level = newLevel;
      const levelData = EVOLUTION_LEVELS[newLevel];

      // Ensure starter power is equipped and unlocked when reaching level >= 1
      if (profile.equippedPowers.length === 0) {
        profile.equippedPowers.push("score_surge");
        state.equippedPowers.push("score_surge");
      }
      if (!profile.unlockedPowers.includes("score_surge")) {
        profile.unlockedPowers.push("score_surge");
      }

      // Generate 3 draft choices matching new level eligibility
      state.pendingDraft = rollDraftChoices(newLevel, null, profile.unlockedPowers || []);

      // Milestone Bonus: Award PP for reaching higher level
      this.addPowerPoints(player, POWER_POINTS_REWARDS.LEVEL_UP, `Level Up Milestone (Level ${newLevel})`);

      // Check level-up achievements
      const unlockedAch = checkAchievements(profile);
      storage.save();

      // Announce in chat
      this.room.broadcast({
        id: 30,
        data: {
          id: 0,
          msg: `LEVEL UP! ${player.name} reached Evolution Level ${newLevel}: ${levelData.title}!`
        }
      });

      if (unlockedAch.length > 0) {
        for (const ach of unlockedAch) {
          this.room.broadcast({
            id: 30,
            data: {
              id: 0,
              msg: `ACHIEVEMENT UNLOCKED! ${player.name} earned '${ach.title}' (+${ach.xpReward} XP, +${POWER_POINTS_REWARDS.ACHIEVEMENT} PP)!`
            }
          });
          state.xp += ach.xpReward;
          profile.xp = state.xp;
          this.addPowerPoints(player, POWER_POINTS_REWARDS.ACHIEVEMENT, `Achievement: ${ach.title}`);
        }
        storage.save();
      }
    } else {
      storage.save();
    }

    this.syncPlayerState(player);
  }

  /**
   * Awards Power Points (PP) to player, persists to storage, and notifies client
   */
  addPowerPoints(player, amount, reason = "") {
    if (!this.isEvolutionMode() || !player || amount <= 0) return;
    const state = this.players.get(player.id);
    if (!state) return;

    state.powerPoints = (state.powerPoints || 0) + amount;
    const profile = storage.getProfile(player.name);
    profile.powerPoints = state.powerPoints;
    storage.save();

    if (player.socket) {
      player.socket.emit("evolution:pp_gain", {
        amount,
        totalPP: state.powerPoints,
        reason
      });
    }

    // If player has no active draft, roll one so they have choices ready to inspect
    if (!state.pendingDraft || state.pendingDraft.length === 0) {
      state.pendingDraft = rollDraftChoices(state.level, null, profile.unlockedPowers || []);
    }

    this.syncPlayerState(player);
  }

  /**
   * Generates or refreshes a power draft for player upon request
   */
  requestDraft(player) {
    if (!this.isEvolutionMode() || !player) return null;
    const state = this.players.get(player.id);
    if (!state) return null;

    const profile = storage.getProfile(player.name);
    state.pendingDraft = rollDraftChoices(state.level, null, profile.unlockedPowers || []);
    this.syncPlayerState(player);
    return state.pendingDraft;
  }

  /**
   * Handles guess results and awards XP, PP, + streaks
   */
  onCorrectGuess(player, timeRemaining, totalDrawTime, isFirstGuess) {
    if (!this.isEvolutionMode()) return;
    const state = this.players.get(player.id);
    if (!state) return;

    // Increment streak
    state.streak++;
    const profile = storage.getProfile(player.name);
    if (!profile.stats) profile.stats = {};
    if (state.streak > (profile.stats.highestStreak || 0)) {
      profile.stats.highestStreak = state.streak;
    }

    let earnedXP = EVOLUTION_XP.CORRECT;
    let earnedPP = POWER_POINTS_REWARDS.CORRECT;

    // Fast guess bonus
    const isFast = (timeRemaining / totalDrawTime) >= 0.75;
    if (isFast) {
      earnedXP += EVOLUTION_XP.FAST;
      earnedPP += POWER_POINTS_REWARDS.FAST;
      profile.stats.fastGuesses = (profile.stats.fastGuesses || 0) + 1;
    }

    // Streak bonus XP & PP
    if (state.streak >= 10) {
      earnedXP += EVOLUTION_XP.STREAK_10;
      earnedPP += POWER_POINTS_REWARDS.STREAK_5;
    } else if (state.streak >= 5) {
      earnedXP += EVOLUTION_XP.STREAK_5;
      earnedPP += POWER_POINTS_REWARDS.STREAK_5;
    } else if (state.streak >= 3) {
      earnedXP += EVOLUTION_XP.STREAK_3;
      earnedPP += POWER_POINTS_REWARDS.STREAK_3;
    } else if (state.streak >= 2) {
      earnedXP += EVOLUTION_XP.STREAK_2;
    }

    if (state.streak >= 3) {
      this.room.broadcast({
        id: 30,
        data: { id: 0, msg: ` ${player.name} is on a ${state.streak} Guess Streak! (+${earnedXP} XP, +${earnedPP} PP)` }
      });
    }

    // Apply Overdrive Ultimate if active
    if (state.buffs.overdrive) {
      earnedXP += 10;
    }

    this.addXP(player, earnedXP, isFast ? "Fast Guess + Streak" : "Correct Guess");
    this.addPowerPoints(player, earnedPP, isFast ? "Fast Guess + Streak" : "Correct Guess");

    // Check Point Bomb room event
    if (this.pointBomb && Date.now() < this.pointBomb.expiresAt) {
      player.score += 100;
      const drawer = this.room.players.get(this.room.game.currentDrawerId);
      if (drawer) drawer.score += 50;
      this.room.broadcast({
        id: 30,
        data: { id: 0, msg: `POINT BOMB DETONATED! ${player.name} scored +100 bonus pts!` }
      });
      this.pointBomb = null;
    }
  }

  /**
   * Called when drawer successfully has word guessed
   */
  onSuccessfulDraw(drawer) {
    if (!this.isEvolutionMode() || !drawer) return;
    const profile = storage.getProfile(drawer.name);
    if (!profile.stats) profile.stats = {};
    profile.stats.successfulDraws = (profile.stats.successfulDraws || 0) + 1;

    this.addXP(drawer, EVOLUTION_XP.DRAW, "Drawing Completion");
    this.addPowerPoints(drawer, POWER_POINTS_REWARDS.DRAW, "Drawing Completion");
  }

  /**
   * Turn end cleanup & resets
   */
  onTurnEnd() {
    if (!this.isEvolutionMode()) return;
    // Reset turn-limited buffs
    for (const state of this.players.values()) {
      state.buffs.scoreSurge = false;
      state.buffs.bullseye = false;
      state.buffs.shapeAssist = false;
      state.buffs.magicBrushUntil = 0;
      state.buffs.trailBrushUntil = 0;
      state.buffs.overdrive = false;

      // Reset streak if player didn't guess
      const player = this.room.players.get(state.playerId);
      if (player && !player.guessed && player.id !== this.room.game.currentDrawerId) {
        state.streak = 0;
      }
      if (player) this.syncPlayerState(player);
    }
  }

  /**
   * Round end awards
   */
  onRoundEnd(roundWinnerId) {
    if (!this.isEvolutionMode() || !roundWinnerId) return;
    const winner = this.room.players.get(roundWinnerId);
    if (!winner) return;

    const profile = storage.getProfile(winner.name);
    if (!profile.stats) profile.stats = {};
    profile.stats.roundsWon = (profile.stats.roundsWon || 0) + 1;

    this.addXP(winner, EVOLUTION_XP.ROUND_WIN, "Round Victory");
    this.addPowerPoints(winner, POWER_POINTS_REWARDS.ROUND_WIN, "Round Victory");

    this.room.broadcast({
      id: 30,
      data: {
        id: 0,
        msg: `🏆 ${winner.name} won the round (+${EVOLUTION_XP.ROUND_WIN} XP, +${POWER_POINTS_REWARDS.ROUND_WIN} PP)!`
      }
    });
  }

  /**
   * Match end awards
   */
  onMatchEnd(winnerPlayerId) {
    if (!this.isEvolutionMode()) return;
    const winner = this.room.players.get(winnerPlayerId);
    if (winner) {
      const profile = storage.getProfile(winner.name);
      if (!profile.stats) profile.stats = {};
      profile.stats.matchesWon = (profile.stats.matchesWon || 0) + 1;
      this.addXP(winner, EVOLUTION_XP.MATCH_WIN, "Match Victory");
      this.addPowerPoints(winner, POWER_POINTS_REWARDS.MATCH_WIN, "Match Victory");
    }
  }

  /**
   * Authoritative Power Unlock using Power Points (PP)
   * 7-point server validation and anti-exploit
   */
  unlockPower(player, powerId) {
    if (!this.isEvolutionMode() || !player) {
      return { success: false, reason: "Evolution mode not active" };
    }
    const state = this.players.get(player.id);
    if (!state) {
      return { success: false, reason: "Player state not found" };
    }
    const power = POWERS[powerId];
    if (!power) {
      return { success: false, reason: "Invalid power ID" };
    }

    const profile = storage.getProfile(player.name);
    profile.unlockedPowers = profile.unlockedPowers || [];

    // 1. Check if already unlocked
    if (profile.unlockedPowers.includes(powerId)) {
      return { success: false, reason: "Power is already unlocked" };
    }

    // 2. Check Level prerequisite
    const levelReq = power.levelReq || 1;
    if (state.level < levelReq) {
      return { success: false, reason: `Requires Evolution Level ${levelReq} (Current: ${state.level})` };
    }

    // 3. Ultimate Power Special Requirement: Level 10 required
    if (power.isUltimate && state.level < 10) {
      return { success: false, reason: "Ultimate powers require Evolution Level 10 (Evolution)" };
    }

    // 4. Power Points cost check
    const cost = power.cost || 5;
    if ((state.powerPoints || 0) < cost) {
      return { success: false, reason: `Insufficient Power Points. Requires ${cost} PP (You have ${state.powerPoints || 0} PP)` };
    }

    // Deduct PP
    state.powerPoints -= cost;
    profile.powerPoints = state.powerPoints;

    // Add to unlocked collection
    profile.unlockedPowers.push(powerId);

    // Auto-equip if player has an empty slot for their current level
    const currentLevelData = EVOLUTION_LEVELS[state.level] || EVOLUTION_LEVELS[0];
    let equipped = false;
    if (power.isUltimate) {
      if (currentLevelData.hasUltimate && !state.ultimatePower) {
        state.ultimatePower = powerId;
        profile.ultimatePower = powerId;
        equipped = true;
      }
    } else {
      const maxSlots = currentLevelData.maxPowers || 0;
      if (state.equippedPowers.length < maxSlots && !state.equippedPowers.includes(powerId)) {
        state.equippedPowers.push(powerId);
        profile.equippedPowers = [...state.equippedPowers];
        equipped = true;
      }
    }

    if (power.maxUses !== null) {
      state.usesRemaining.set(powerId, power.maxUses);
    }

    // Refresh pending draft
    state.pendingDraft = rollDraftChoices(state.level, null, profile.unlockedPowers);

    storage.save();
    this.syncPlayerState(player);

    if (player.socket) {
      player.socket.emit("evolution:power_unlocked", {
        powerId,
        powerName: power.name,
        powerRarity: power.rarity,
        powerBranch: power.branch,
        cost,
        remainingPP: state.powerPoints,
        equipped
      });
    }

    this.room.broadcast({
      id: 30,
      data: {
        id: 0,
        msg: `✨ ${player.name} unlocked power: ${power.name} (${power.rarity})!`
      }
    });

    return { success: true, powerId, remainingPP: state.powerPoints, equipped };
  }

  /**
   * Handles player selecting a power from draft (backward-compatible alias)
   */
  selectPower(player, powerId) {
    return this.unlockPower(player, powerId);
  }

  /**
   * Server-side power activation with authoritative 10-point validation and anti-exploit
   */
  activatePower(player, requestData) {
    let powerId = "";
    let targetId = null;
    let powerRequestId = null;

    if (typeof requestData === "object" && requestData !== null) {
      powerId = requestData.powerId;
      targetId = requestData.targetId;
      powerRequestId = requestData.powerRequestId;
    } else {
      powerId = String(requestData || "");
    }

    const reject = (reason) => {
      if (player && player.socket) {
        player.socket.emit("evolution:power_error", {
          powerId,
          reason
        });
      }
      return { success: false, reason };
    };

    // 1. Player check
    if (!player) return { success: false, reason: "Player does not exist" };
    if (!this.room.players.has(player.id)) return reject("Player is not in the room");

    // 2. Mode check
    if (!this.isEvolutionMode()) return reject("Room is not in Evolution Mode");

    // 3. Active match check (powers can only be used during active gameplay)
    const game = this.room.game;
    if (!game || (game.state !== 3 && game.state !== 4)) {
      return reject("Powers can only be activated during an active match");
    }

    // 4. State check
    const state = this.players.get(player.id);
    if (!state) return reject("Player evolution state not found");

    // 5. Idempotency protection against double clicks
    const now = Date.now();
    if (powerRequestId) {
      if (this.processedRequestIds.has(powerRequestId)) {
        return { success: true, ignored: true };
      }
      this.processedRequestIds.set(powerRequestId, now);
      // Clean up requests older than 15s
      for (const [rId, t] of this.processedRequestIds.entries()) {
        if (now - t > 15000) this.processedRequestIds.delete(rId);
      }
    }

    // 6. Anti-spam rate limiting: minimum 250ms between actions
    const lastAction = this.lastActionTimes.get(player.id) || 0;
    if (now - lastAction < 250) {
      return reject("Please wait a moment before activating another power");
    }
    this.lastActionTimes.set(player.id, now);

    // 7. Power definition check
    const power = POWERS[powerId];
    if (!power) return reject("Invalid power ID");

    // 8. Level requirement check
    if (state.level < (power.levelReq || 1)) {
      return reject(`Evolution Level ${power.levelReq} required to use this power`);
    }

    // 9. Ownership check
    const profile = storage.getProfile(player.name);
    const unlocked = profile.unlockedPowers || [];
    if (!unlocked.includes(powerId) && !state.equippedPowers.includes(powerId) && state.ultimatePower !== powerId) {
      return reject("You have not unlocked this power yet");
    }

    // 10. Equipped check
    const isEquipped = state.equippedPowers.includes(powerId) || state.ultimatePower === powerId;
    if (!isEquipped) {
      return reject("Power is not currently equipped in your active slots");
    }

    // 11. Uses remaining check
    if (power.maxUses !== null) {
      const remaining = state.usesRemaining.has(powerId) ? state.usesRemaining.get(powerId) : power.maxUses;
      if (remaining <= 0) {
        return reject("No uses remaining for this power in this match");
      }
    }

    // 12. Cooldown check
    const cooldownExpires = state.cooldowns.get(powerId) || 0;
    if (now < cooldownExpires) {
      const waitSec = Math.ceil((cooldownExpires - now) / 1000);
      return reject(`Power is on cooldown (${waitSec}s remaining)`);
    }

    // 13. Allowed match phase check
    if (Array.isArray(power.allowedPhases) && !power.allowedPhases.includes(game.state)) {
      if (game.state === 3 && power.allowedPhases.includes(4)) {
        return reject("This power can only be used during the drawing phase");
      }
      return reject("Cannot use this power in the current round phase");
    }

    // 14. Role check (drawer vs guesser)
    const isDrawer = player.id === game.currentDrawerId;
    if (power.allowedRoles === "drawer" && !isDrawer) {
      return reject("Only the active drawer can use this power");
    }
    if (power.allowedRoles === "guesser" && isDrawer) {
      return reject("The active drawer cannot use guessing/attack powers");
    }
    if (power.allowedRoles === "guesser" && player.guessed) {
      return reject("You have already correctly guessed the word this turn");
    }

    // 14. Target validation (for target powers like score_steal)
    let target = null;
    if (power.targetType === "opponent") {
      if (targetId !== null && targetId !== undefined) {
        const parsedTId = parseInt(targetId, 10);
        target = this.room.players.get(parsedTId);
        if (!target) return reject("Target player not found in the room");
        if (target.id === player.id) return reject("Cannot target yourself");
      } else {
        // Fallback: target highest-scoring opponent
        const opponents = this.room.getActivePlayers().filter(p => p.id !== player.id);
        opponents.sort((a, b) => b.score - a.score);
        target = opponents[0] || null;
      }
      if (!target) return reject("No valid opponent available to target");
    }

    if (!profile.stats) profile.stats = {};

    // ==========================================
    // EXECUTE AUTHORITATIVE POWER EFFECTS
    // ==========================================
    let broadcastMsg = `${player.name} activated ${power.name}!`;
    let privateMsg = "";
    let effectData = { type: power.id };

    switch (power.id) {
      // --- ATTACK ---
      case "score_surge":
        state.buffs.scoreSurge = true;
        effectData = { type: "score_surge" };
        privateMsg = "⚡ Score Surge active! Your next correct guess earns +50% bonus points.";
        break;

      case "point_bomb":
        this.pointBomb = { active: true, expiresAt: now + 10000, placedBy: player.id };
        effectData = { type: "point_bomb", duration: 10 };
        broadcastMsg = `💣 ${player.name} dropped a Point Bomb! Next correct guess in 10s gets +100 bonus pts!`;
        break;

      case "score_steal": {
        const targetState = this.players.get(target.id);
        if (targetState && (targetState.buffs.shield || targetState.buffs.scoreLockUntil > now)) {
          if (targetState.buffs.shield) {
            targetState.buffs.shield = false; // Shield blocks & is consumed!
            broadcastMsg = `🛡️ ${target.name}'s Shield blocked ${player.name}'s Score Steal!`;
            const targetProfile = storage.getProfile(target.name);
            targetProfile.stats.shieldsUsed = (targetProfile.stats.shieldsUsed || 0) + 1;
            checkAchievements(targetProfile);
            this.syncPlayerState(target);
          } else {
            broadcastMsg = `🔒 ${target.name}'s Score Lock blocked ${player.name}'s Score Steal!`;
          }
          effectData = { type: "score_steal", blocked: true, targetId: target.id };
        } else {
          const stealAmount = Math.min(40, Math.max(0, target.score));
          target.score = Math.max(0, target.score - stealAmount);
          player.score += stealAmount;
          broadcastMsg = `🦹 ${player.name} stole ${stealAmount} points from ${target.name}!`;
          effectData = { type: "score_steal", amount: stealAmount, targetId: target.id };
        }
        break;
      }

      case "double_strike":
        state.buffs.doubleStrike = 2;
        effectData = { type: "double_strike", charges: 2 };
        privateMsg = "⚔️ Double Strike active! Your next two guesses earn +30% bonus points.";
        break;

      case "bullseye":
        state.buffs.bullseye = true;
        effectData = { type: "bullseye" };
        privateMsg = "🎯 Bullseye primed! Guess correctly in the first 15s for +100 bonus pts.";
        break;

      // --- GUESSING / INTELLIGENCE ---
      case "letter_vision": {
        const secret = game.secretWord || "";
        const unrevealed = [];
        for (let i = 0; i < secret.length; i++) {
          if (secret[i] !== " " && !game.revealedHintIndices.has(i)) {
            unrevealed.push({ idx: i, char: secret[i] });
          }
        }
        if (unrevealed.length === 0) {
          for (let i = 0; i < secret.length; i++) {
            if (secret[i] !== " ") unrevealed.push({ idx: i, char: secret[i] });
          }
        }
        if (unrevealed.length > 0) {
          const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
          player.socket.emit("evolution:letter_vision", { index: pick.idx, letter: pick.char });
          effectData = { type: "letter_vision", index: pick.idx, letter: pick.char };
          privateMsg = `👁️ Letter Vision revealed letter #${pick.idx + 1}: '${pick.char.toUpperCase()}'!`;
        } else {
          return reject("No unrevealed letters left to scan");
        }
        break;
      }

      case "word_scan": {
        const secret = game.secretWord || "";
        const len = secret.replace(/ /g, "").length;
        const categories = ["Object", "Nature", "Animal", "Food", "Action", "Person", "Place", "Sci-Fi"];
        const hash = secret.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const cat = categories[hash % categories.length];
        player.socket.emit("evolution:word_scan", { length: len, category: cat });
        effectData = { type: "word_scan", length: len, category: cat };
        privateMsg = `🔍 Word Scan: Secret word has ${len} letters. Category: [${cat}]`;
        break;
      }

      case "pattern_sense": {
        const secret = (game.secretWord || "").trim();
        if (secret.length > 0) {
          const firstChar = secret[0].toUpperCase();
          const lastChar = secret[secret.length - 1].toUpperCase();
          const vowels = ["A", "E", "I", "O", "U"];
          const isVowel = vowels.includes(firstChar);
          player.socket.emit("evolution:pattern_sense", { first: firstChar, last: lastChar });
          effectData = { type: "pattern_sense", first: firstChar, last: lastChar };
          privateMsg = `🧩 Pattern Sense: Starts with '${firstChar}' (${isVowel ? "Vowel" : "Consonant"}) and ends with '${lastChar}'.`;
        } else {
          return reject("Secret word not available");
        }
        break;
      }

      case "hint_pulse": {
        const secret = (game.secretWord || "").toLowerCase();
        const vowels = ["a", "e", "i", "o", "u"];
        const vowelCount = secret.split("").filter(c => vowels.includes(c)).length;
        const consonantCount = secret.replace(/[^a-z]/g, "").length - vowelCount;
        effectData = { type: "hint_pulse", vowelCount, consonantCount, total: secret.length };
        privateMsg = `💡 Hint Pulse: ${vowelCount} vowels, ${consonantCount} consonants, ${secret.length} total characters.`;
        break;
      }

      case "second_thought":
        state.buffs.secondThought = true;
        effectData = { type: "second_thought" };
        privateMsg = "💭 Second Thought active: Protected against next wrong guess spam penalty.";
        break;

      case "ghost_guess":
        state.buffs.ghostGuess = true;
        effectData = { type: "ghost_guess" };
        privateMsg = "👻 Ghost Guess active: Your next close guess within 2 letters will count as correct!";
        break;

      // --- DRAWING / CREATOR ---
      case "magic_brush":
        state.buffs.magicBrushUntil = now + 25000;
        effectData = { type: "magic_brush", duration: 25, drawerId: player.id };
        this.room.broadcastCustom("evolution:effect", effectData);
        broadcastMsg = `🖌️ ${player.name} activated Magic Rainbow Brush!`;
        break;

      case "shape_assist":
        state.buffs.shapeAssist = true;
        effectData = { type: "shape_assist", duration: 30 };
        player.socket.emit("evolution:effect", effectData);
        privateMsg = "📐 Shape Assist active: Next strokes automatically smoothed into straight geometry.";
        break;

      case "color_burst":
        state.buffs.colorBurstUntil = now + 30000;
        effectData = { type: "color_burst", duration: 30 };
        player.socket.emit("evolution:color_burst", effectData);
        privateMsg = "🎨 Color Burst: 6 vibrant bonus colors unlocked on toolbar for 30s!";
        break;

      case "perfect_line":
        effectData = { type: "perfect_line", duration: 20 };
        player.socket.emit("evolution:perfect_line", effectData);
        privateMsg = "📏 Perfect Line primed: Click down and release to draw a ruler-straight line.";
        break;

      case "trail_brush":
        state.buffs.trailBrushUntil = now + 20000;
        effectData = { type: "trail_brush", duration: 20 };
        this.room.broadcastCustom("evolution:effect", effectData);
        broadcastMsg = `✨ ${player.name} activated Shimmering Trail Brush!`;
        break;

      case "instant_clean": {
        const cmds = this.room.drawCommands || [];
        if (cmds.length > 0) {
          this.room.drawCommands = cmds.slice(0, Math.max(0, cmds.length - 3));
          this.room.broadcast({ id: 21, data: this.room.drawCommands.length });
          effectData = { type: "instant_clean", remainingCommands: this.room.drawCommands.length };
          privateMsg = "🧹 Instant Clean: Reverted your latest 3 drawing strokes.";
        } else {
          return reject("Canvas has no strokes to revert");
        }
        break;
      }

      // --- DEFENSE ---
      case "shield":
        state.buffs.shield = true;
        profile.stats.shieldsUsed = (profile.stats.shieldsUsed || 0) + 1;
        checkAchievements(profile);
        effectData = { type: "shield" };
        privateMsg = "🛡️ Shield activated: Protected against the next steal or penalty.";
        break;

      case "second_life":
        state.buffs.shield = true;
        state.buffs.scoreLockUntil = now + 30000;
        state.usesRemaining.set("second_life", 0);
        effectData = { type: "second_life", duration: 30 };
        privateMsg = "💖 Second Life: Shield granted and score locked for 30 seconds! (1 use per match)";
        break;

      case "time_guard":
        if (game.timeLeft > 0) {
          const drawTime = parseInt(this.room.settings[2]) || 80;
          game.timeLeft = Math.min(drawTime, game.timeLeft + 5);
          effectData = { type: "time_guard", addedSeconds: 5, newTime: game.timeLeft };
          broadcastMsg = `⏳ ${player.name} activated Time Guard (+5s added to timer)!`;
        }
        break;

      case "score_lock":
        state.buffs.scoreLockUntil = now + 45000;
        effectData = { type: "score_lock", duration: 45 };
        privateMsg = "🔒 Score Lock: Your score is immune to steals for 45s.";
        break;

      case "freeze_guard":
        state.buffs.freezeGuardUntil = now + 50000;
        effectData = { type: "freeze_guard", duration: 50 };
        privateMsg = "❄️ Freeze Guard: Immune to enemy chaos modifiers for 50s.";
        break;

      // --- CHAOS ---
      case "randomizer": {
        const mods = [
          { name: "Double XP Burst", action: () => { this.addXP(player, 15, "Randomizer Double XP"); } },
          { name: "Speed Rush (+10s)", action: () => { const dt = parseInt(this.room.settings[2]) || 80; game.timeLeft = Math.min(dt, game.timeLeft + 10); } },
          { name: "Free Letter Hint", action: () => { game.revealHint(); } },
          { name: "Point Splash (+25 pts to guessers)", action: () => {
              for (const p of this.room.players.values()) {
                if (p.id !== game.currentDrawerId) p.score += 25;
              }
            }
          }
        ];
        const chosenMod = mods[Math.floor(Math.random() * mods.length)];
        chosenMod.action();
        broadcastMsg = `🎲 ${player.name} rolled the Randomizer: ${chosenMod.name}!`;
        effectData = { type: "randomizer", modifier: chosenMod.name };
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "reverse_canvas": {
        const immunePlayerIds = [];
        for (const [pId, pState] of this.players.entries()) {
          if (pId === player.id) continue;
          if (pState.buffs.freezeGuardUntil > now) {
            immunePlayerIds.push(pId);
          } else if (pState.buffs.shield) {
            pState.buffs.shield = false;
            immunePlayerIds.push(pId);
            const targetP = this.room.players.get(pId);
            if (targetP && targetP.socket) {
              targetP.socket.emit("data", { id: 30, data: { id: 0, msg: "🛡️ Your Shield blocked Reverse Canvas!" } });
            }
            this.syncPlayerState(this.room.players.get(pId));
          }
        }
        effectData = { type: "reverse_canvas", duration: 15, immunePlayerIds };
        this.room.broadcastCustom("evolution:effect", effectData);
        broadcastMsg = `🔄 ${player.name} reversed the drawing canvas for 15 seconds!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "chaos_brush": {
        const drawer = this.room.players.get(game.currentDrawerId);
        const drawerState = drawer ? this.players.get(drawer.id) : null;
        if (drawerState && (drawerState.buffs.freezeGuardUntil > now || drawerState.buffs.shield)) {
          if (drawerState.buffs.shield) drawerState.buffs.shield = false;
          broadcastMsg = `🛡️ ${drawer.name}'s defense blocked Chaos Brush!`;
          effectData = { type: "chaos_brush", blocked: true };
          this.syncPlayerState(drawer);
        } else {
          effectData = { type: "chaos_brush", duration: 10 };
          this.room.broadcastCustom("evolution:effect", effectData);
          broadcastMsg = `🌀 Chaos Brush activated by ${player.name}: Maximum brush size locked for 10s!`;
        }
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "time_warp": {
        const delta = Math.random() < 0.5 ? 5 : -5;
        const drawTime = parseInt(this.room.settings[2]) || 80;
        game.timeLeft = Math.max(15, Math.min(drawTime, game.timeLeft + delta));
        broadcastMsg = `⏰ ${player.name} warped time by ${delta > 0 ? "+5" : "-5"} seconds!`;
        effectData = { type: "time_warp", delta, newTime: game.timeLeft };
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "ghost_canvas": {
        const ghostStrokes = game.lastRoundCanvas || [];
        effectData = { type: "ghost_canvas", duration: 12, commands: ghostStrokes };
        this.room.broadcastCustom("evolution:effect", effectData);
        broadcastMsg = `🌫️ Ghost Canvas summoned by ${player.name}!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "mystery_rule":
        this.pointBomb = { active: true, expiresAt: now + 20000, placedBy: player.id };
        broadcastMsg = `❓ MYSTERY RULE: Next guesser receives +50 bonus XP and +50 points!`;
        effectData = { type: "mystery_rule", duration: 20 };
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;

      // --- ADVANCED ---
      case "power_chain":
        state.buffs.scoreSurge = true;
        state.buffs.bullseye = true;
        effectData = { type: "power_chain" };
        privateMsg = "🔗 Power Chain: Score Surge AND Bullseye activated together!";
        break;

      case "mutation":
        state.cooldowns.clear();
        effectData = { type: "mutation" };
        privateMsg = "🧬 Mutation complete: Cooldowns instantly refreshed across all equipped powers!";
        break;

      case "evolution_choice":
        state.pendingDraft = rollDraftChoices(state.level, null, state.equippedPowers);
        effectData = { type: "evolution_choice" };
        privateMsg = "📜 Evolution Choice: 3 new powers offered for draft!";
        break;

      case "power_swap": {
        const available = (profile.unlockedPowers || []).filter(pId => !state.equippedPowers.includes(pId) && pId !== state.ultimatePower && pId !== "power_swap");
        if (available.length > 0) {
          const newPower = available[Math.floor(Math.random() * available.length)];
          const pObj = POWERS[newPower];
          state.equippedPowers = state.equippedPowers.map(pId => pId === "power_swap" ? newPower : pId);
          profile.equippedPowers = [...state.equippedPowers];
          storage.save();
          broadcastMsg = `🔃 ${player.name} swapped power for ${pObj.name}!`;
          effectData = { type: "power_swap", newPower };
        } else {
          return reject("No other unlocked powers available to swap");
        }
        break;
      }

      case "rare_drop": {
        const pool = Object.values(POWERS).filter(p => !p.isUltimate && (p.rarity === "EPIC" || p.rarity === "LEGENDARY") && !profile.unlockedPowers.includes(p.id));
        const roll = pool[Math.floor(Math.random() * pool.length)] || Object.values(POWERS).find(p => p.rarity === "EPIC");
        if (roll && !profile.unlockedPowers.includes(roll.id)) {
          profile.unlockedPowers.push(roll.id);
        }
        broadcastMsg = `🎁 RARE DROP! ${player.name} received ${roll.name}!`;
        effectData = { type: "rare_drop", unlockedPower: roll.id };
        storage.save();
        break;
      }

      // --- ULTIMATE POWERS ---
      case "reality_shift": {
        const drawTime = parseInt(this.room.settings[2]) || 80;
        game.timeLeft = Math.min(drawTime, game.timeLeft + 15);
        this.pointBomb = { active: true, expiresAt: now + 15000, placedBy: player.id };
        broadcastMsg = `🌌 REALITY SHIFT! ${player.name} altered reality (+15s clock & 15s Point Event)!`;
        effectData = { type: "reality_shift", addedSeconds: 15 };
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "overdrive":
        state.buffs.overdrive = true;
        effectData = { type: "overdrive" };
        privateMsg = "⚡🔥 OVERDRIVE ACTIVE: +50% score boost and +10 bonus XP on correct guesses!";
        broadcastMsg = `⚡🔥 ${player.name} entered OVERDRIVE!`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "omniscience": {
        const secret = game.secretWord || "";
        const len = secret.length;
        const chars = secret.split("").filter(c => c !== " ");
        const revealed = chars.slice(0, 3).join(", ").toUpperCase();
        player.socket.emit("evolution:letter_vision", { index: 0, letter: secret[0] || "" });
        effectData = { type: "omniscience", length: len, revealed };
        privateMsg = `🔮 OMNISCIENCE: Letters revealed: [${revealed}], Total length: ${len}`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "final_form":
        state.buffs.scoreSurge = true;
        state.buffs.doubleStrike = 2;
        state.buffs.shield = true;
        effectData = { type: "final_form" };
        broadcastMsg = `👑 ${player.name} ASCENDED TO FINAL FORM! All power buffs active!`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "apocalypse": {
        for (const p of this.room.players.values()) {
          p.score += 50;
        }
        const drawTime = parseInt(this.room.settings[2]) || 80;
        game.timeLeft = Math.min(drawTime, game.timeLeft + 10);
        broadcastMsg = `☄️ APOCALYPSE EVENT! +50 points to all players & +10s clock extension!`;
        effectData = { type: "apocalypse" };
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      default:
        return reject("Power effect is not implemented yet");
    }

    // Set authoritative cooldown timestamp
    const cooldownDuration = (power.cooldown || 40) * 1000;
    const cooldownEndsAt = now + cooldownDuration;
    state.cooldowns.set(powerId, cooldownEndsAt);

    // Decrement limited uses if applicable
    if (power.maxUses !== null) {
      const curUses = state.usesRemaining.has(powerId) ? state.usesRemaining.get(powerId) : power.maxUses;
      state.usesRemaining.set(powerId, Math.max(0, curUses - 1));
    }

    // Announce in chat
    if (broadcastMsg) {
      this.room.broadcast({
        id: 30,
        data: { id: 0, msg: broadcastMsg }
      });
    }

    if (privateMsg && player.socket) {
      player.socket.emit("data", {
        id: 30,
        data: { id: 0, msg: privateMsg }
      });
    }

    // Broadcast standard authoritative power activated event
    this.room.broadcastCustom("evolution:power_activated", {
      playerId: player.id,
      playerName: player.name,
      powerId: power.id,
      powerName: power.name,
      powerRarity: power.rarity,
      powerBranch: power.branch,
      targetId: target ? target.id : null,
      targetName: target ? target.name : null,
      cooldownEndsAt: cooldownEndsAt,
      usesRemaining: state.usesRemaining.get(powerId) ?? null,
      effect: effectData
    });

    // Also broadcast legacy evolution:power_used for backwards compatibility
    this.room.broadcastCustom("evolution:power_used", {
      playerId: player.id,
      playerName: player.name,
      powerId: power.id,
      powerName: power.name,
      powerRarity: power.rarity,
      powerBranch: power.branch
    });

    this.syncPlayerState(player);
    return { success: true, powerId, cooldownEndsAt };
  }

  /**
   * Unequips an equipped power, moving it to unequipped collection
   */
  unequipPower(player, powerId) {
    if (!this.isEvolutionMode() || !player) return { success: false, reason: "Invalid request" };
    const state = this.players.get(player.id);
    if (!state) return { success: false, reason: "Player state not found" };

    const profile = storage.getProfile(player.name);

    if (state.ultimatePower === powerId) {
      state.ultimatePower = null;
      profile.ultimatePower = null;
    } else {
      const idx = state.equippedPowers.indexOf(powerId);
      if (idx !== -1) {
        state.equippedPowers.splice(idx, 1);
        profile.equippedPowers = [...state.equippedPowers];
      }
    }

    // Ensure it remains in unlockedPowers collection
    if (!profile.unlockedPowers.includes(powerId)) {
      profile.unlockedPowers.push(powerId);
    }

    storage.save();
    this.syncPlayerState(player);
    return { success: true };
  }

  /**
   * Equips an unlocked power into an available slot
   */
  equipPower(player, powerId, targetSlot = -1) {
    if (!this.isEvolutionMode() || !player) return { success: false, reason: "Invalid request" };
    const state = this.players.get(player.id);
    if (!state) return { success: false, reason: "Player state not found" };

    const power = POWERS[powerId];
    if (!power) return { success: false, reason: "Invalid power" };

    const profile = storage.getProfile(player.name);
    const unlocked = profile.unlockedPowers || [];
    if (!unlocked.includes(powerId)) {
      return { success: false, reason: "Power not unlocked" };
    }

    const currentLevelData = EVOLUTION_LEVELS[state.level] || EVOLUTION_LEVELS[0];

    if (power.isUltimate) {
      if (!currentLevelData.hasUltimate) {
        return { success: false, reason: "Ultimate slot locked until Level 7" };
      }
      state.ultimatePower = powerId;
      profile.ultimatePower = powerId;
    } else {
      const maxSlots = currentLevelData.maxPowers || 0;
      if (maxSlots <= 0) {
        return { success: false, reason: "No power slots unlocked yet" };
      }

      // Check if already equipped
      if (state.equippedPowers.includes(powerId)) {
        return { success: false, reason: "Power already equipped" };
      }

      const slotIdx = parseInt(targetSlot, 10);
      if (!isNaN(slotIdx) && slotIdx >= 0 && slotIdx < maxSlots) {
        if (slotIdx < state.equippedPowers.length) {
          state.equippedPowers[slotIdx] = powerId;
        } else {
          state.equippedPowers.push(powerId);
        }
      } else {
        if (state.equippedPowers.length < maxSlots) {
          state.equippedPowers.push(powerId);
        } else {
          // Replace first slot if full
          state.equippedPowers[0] = powerId;
        }
      }
      profile.equippedPowers = [...state.equippedPowers];
    }

    if (power.maxUses !== null && !state.usesRemaining.has(powerId)) {
      state.usesRemaining.set(powerId, power.maxUses);
    }

    storage.save();
    this.syncPlayerState(player);
    return { success: true };
  }

  /**
   * Cleans up resources when room is destroyed
   */
  destroy() {
    this.players.clear();
    this.lastActionTimes.clear();
    this.processedRequestIds.clear();
  }
}

module.exports = EvolutionManager;
