/**
 * Room-level Evolution Mode Manager
 */

const { EVOLUTION_LEVELS, EVOLUTION_XP } = require("./config");
const { POWERS, rollDraftChoices } = require("./powers");
const { checkAchievements } = require("./achievements");
const storage = require("./storage");

class EvolutionManager {
  constructor(room) {
    this.room = room;
    this.players = new Map(); // playerId -> state
    this.lastActionTimes = new Map(); // playerId -> timestamp (anti-spam)
    this.activeRoomModifiers = new Map(); // key -> { expiresAt, data }
    this.pointBomb = null; // { active: bool, expiresAt: number }
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

    // Default basic power for level >= 1 if none equipped
    if (level >= 1 && profile.equippedPowers.length === 0) {
      profile.equippedPowers.push("score_surge");
    }

    const state = {
      playerId: player.id,
      name: player.name,
      xp: profile.xp,
      level: level,
      equippedPowers: [...profile.equippedPowers],
      ultimatePower: profile.ultimatePower,
      cooldowns: new Map(), // powerId -> expiresAt
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
        overdrive: false
      },
      pendingDraft: null
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

    // Format cooldowns as seconds remaining
    const now = Date.now();
    const cooldownsObj = {};
    for (const [pId, exp] of state.cooldowns.entries()) {
      if (exp > now) {
        cooldownsObj[pId] = Math.ceil((exp - now) / 1000);
      }
    }

    const payload = {
      isEvolutionMode: this.isEvolutionMode(),
      level: state.level,
      title: currentLevelData.title,
      xp: state.xp,
      currentLevelXp: currentLevelData.xpRequired,
      nextLevelXp: nextLevelData.xpRequired,
      equippedPowers: state.equippedPowers.map(pId => POWERS[pId] || null).filter(Boolean),
      ultimatePower: state.ultimatePower ? (POWERS[state.ultimatePower] || null) : null,
      cooldowns: cooldownsObj,
      streak: state.streak,
      buffs: {
        shield: state.buffs.shield,
        scoreLock: state.buffs.scoreLockUntil > now,
        colorBurst: state.buffs.colorBurstUntil > now
      },
      pendingDraft: state.pendingDraft
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

      // Generate 3 draft choices
      const allCurrent = [...state.equippedPowers];
      if (state.ultimatePower) allCurrent.push(state.ultimatePower);
      state.pendingDraft = rollDraftChoices(newLevel, null, allCurrent);

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
              msg: `ACHIEVEMENT UNLOCKED! ${player.name} earned '${ach.title}' (+${ach.xpReward} XP)!`
            }
          });
          state.xp += ach.xpReward;
          profile.xp = state.xp;
        }
        storage.save();
      }
    } else {
      storage.save();
    }

    this.syncPlayerState(player);
  }

  /**
   * Handles guess results and awards XP + streaks
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

    // Fast guess bonus
    const isFast = (timeRemaining / totalDrawTime) >= 0.75;
    if (isFast) {
      earnedXP += EVOLUTION_XP.FAST;
      profile.stats.fastGuesses = (profile.stats.fastGuesses || 0) + 1;
    }

    // Streak bonus XP
    if (state.streak >= 10) earnedXP += EVOLUTION_XP.STREAK_10;
    else if (state.streak >= 5) earnedXP += EVOLUTION_XP.STREAK_5;
    else if (state.streak >= 3) earnedXP += EVOLUTION_XP.STREAK_3;
    else if (state.streak >= 2) earnedXP += EVOLUTION_XP.STREAK_2;

    if (state.streak >= 3) {
      this.room.broadcast({
        id: 30,
        data: { id: 0, msg: ` ${player.name} is on a ${state.streak} Guess Streak! (+${earnedXP} XP)` }
      });
    }

    // Apply Overdrive Ultimate if active
    if (state.buffs.overdrive) {
      earnedXP += 10;
    }

    this.addXP(player, earnedXP, isFast ? "Fast Guess + Streak" : "Correct Guess");

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
    }
  }

  /**
   * Handles player selecting a power from level-up draft
   */
  selectPower(player, powerId) {
    const state = this.players.get(player.id);
    if (!state || !state.pendingDraft) return false;

    const chosen = state.pendingDraft.find(p => p.id === powerId);
    if (!chosen) return false;

    const profile = storage.getProfile(player.name);

    if (chosen.isUltimate) {
      state.ultimatePower = chosen.id;
      profile.ultimatePower = chosen.id;
    } else {
      // Add to equipped powers (max 3)
      if (state.equippedPowers.length < 3) {
        state.equippedPowers.push(chosen.id);
      } else {
        // Replace oldest or swap
        state.equippedPowers.shift();
        state.equippedPowers.push(chosen.id);
      }
      profile.equippedPowers = [...state.equippedPowers];
    }

    if (!profile.unlockedPowers.includes(chosen.id)) {
      profile.unlockedPowers.push(chosen.id);
    }

    state.pendingDraft = null;
    storage.save();
    this.syncPlayerState(player);

    this.room.broadcast({
      id: 30,
      data: { id: 0, msg: ` ${player.name} equipped power: ${chosen.name}!` }
    });

    return true;
  }

  /**
   * Server-side power activation with validation and anti-exploit
   */
  activatePower(player, powerId) {
    if (!this.isEvolutionMode()) return { success: false, reason: "Not Evolution Mode" };

    const state = this.players.get(player.id);
    if (!state) return { success: false, reason: "Player state not found" };

    const power = POWERS[powerId];
    if (!power) return { success: false, reason: "Invalid power" };

    // Anti-spam rate limiting: 1 activation per 1000ms
    const now = Date.now();
    const lastAction = this.lastActionTimes.get(player.id) || 0;
    if (now - lastAction < 1000) {
      return { success: false, reason: "Action rate limit exceeded" };
    }
    this.lastActionTimes.set(player.id, now);

    // Verify ownership
    const isEquipped = state.equippedPowers.includes(powerId) || state.ultimatePower === powerId;
    if (!isEquipped) {
      return { success: false, reason: "Power not equipped" };
    }

    // Verify cooldown
    const cooldownExpires = state.cooldowns.get(powerId) || 0;
    if (now < cooldownExpires) {
      const waitSec = Math.ceil((cooldownExpires - now) / 1000);
      return { success: false, reason: `Power on cooldown (${waitSec}s)` };
    }

    // Validate game phase (must be in DRAWING or WORD_CHOICE)
    const game = this.room.game;
    if (game.state !== 4 && game.state !== 3) {
      return { success: false, reason: "Cannot use powers outside active rounds" };
    }

    const isDrawer = player.id === game.currentDrawerId;
    const profile = storage.getProfile(player.name);
    if (!profile.stats) profile.stats = {};

    // ==========================================
    // EXECUTE POWER EFFECTS
    // ==========================================
    let broadcastMsg = `${player.name} activated ${power.icon} ${power.name}!`;
    let privateMsg = "";

    switch (power.id) {
      // --- ATTACK ---
      case "score_surge":
        state.buffs.scoreSurge = true;
        privateMsg = "Score Surge active! Your next correct guess earns +50% bonus score.";
        break;

      case "point_bomb":
        this.pointBomb = { active: true, expiresAt: now + 10000 };
        broadcastMsg = ` ${player.name} dropped a Point Bomb! Next correct guess in 10s gets +100 bonus pts!`;
        break;

      case "score_steal": {
        // Target top player other than self
        const opponents = this.room.getActivePlayers().filter(p => p.id !== player.id);
        opponents.sort((a, b) => b.score - a.score);
        const target = opponents[0];
        if (target) {
          const targetState = this.players.get(target.id);
          if (targetState && (targetState.buffs.shield || targetState.buffs.scoreLockUntil > now)) {
            if (targetState.buffs.shield) targetState.buffs.shield = false;
            broadcastMsg = `️ ${target.name}'s Shield blocked ${player.name}'s Score Steal!`;
            if (targetState) {
              const targetProfile = storage.getProfile(target.name);
              targetProfile.stats.shieldsUsed = (targetProfile.stats.shieldsUsed || 0) + 1;
              checkAchievements(targetProfile);
            }
          } else {
            const stealAmount = Math.min(40, target.score);
            target.score -= stealAmount;
            player.score += stealAmount;
            broadcastMsg = `️ ${player.name} stole ${stealAmount} points from ${target.name}!`;
          }
        }
        break;
      }

      case "double_strike":
        state.buffs.doubleStrike = 2;
        privateMsg = "Double Strike active! Your next two guesses earn +30% bonus points.";
        break;

      case "bullseye":
        state.buffs.bullseye = true;
        privateMsg = "Bullseye primed! Guess correctly in the first 15s for +100 bonus pts.";
        break;

      // --- GUESSING ---
      case "letter_vision": {
        const secret = game.secretWord || "";
        const unrevealed = [];
        for (let i = 0; i < secret.length; i++) {
          if (secret[i] !== " ") unrevealed.push({ idx: i, char: secret[i] });
        }
        if (unrevealed.length > 0) {
          const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
          player.socket.emit("evolution:letter_vision", { index: pick.idx, letter: pick.char });
          privateMsg = `Letter Vision revealed letter #${pick.idx + 1}: '${pick.char.toUpperCase()}'!`;
        }
        break;
      }

      case "word_scan": {
        const secret = game.secretWord || "";
        const len = secret.replace(/ /g, "").length;
        const categories = ["Object", "Nature", "Animal", "Food", "Action", "Person", "Place"];
        const hash = secret.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const cat = categories[hash % categories.length];
        player.socket.emit("evolution:word_scan", { length: len, category: cat });
        privateMsg = `Word Scan: Secret word has ${len} letters. Category: [${cat}]`;
        break;
      }

      case "pattern_sense": {
        const secret = game.secretWord || "";
        if (secret.length > 0) {
          const firstChar = secret[0].toUpperCase();
          const lastChar = secret[secret.length - 1].toUpperCase();
          const vowels = ["A", "E", "I", "O", "U"];
          const isVowel = vowels.includes(firstChar);
          player.socket.emit("evolution:pattern_sense", { first: firstChar, last: lastChar });
          privateMsg = `Pattern Sense: Starts with '${firstChar}' (${isVowel ? "Vowel" : "Consonant"}) and ends with '${lastChar}'.`;
        }
        break;
      }

      case "hint_pulse": {
        const secret = game.secretWord || "";
        const vowels = ["a", "e", "i", "o", "u"];
        const vowelCount = secret.split("").filter(c => vowels.includes(c.toLowerCase())).length;
        privateMsg = `Hint Pulse: The secret word contains ${vowelCount} vowels and ${secret.length} characters.`;
        break;
      }

      case "second_thought":
        state.buffs.secondThought = true;
        privateMsg = "Second Thought active: Protected against next wrong guess penalty.";
        break;

      case "ghost_guess":
        state.buffs.ghostGuess = true;
        privateMsg = "Ghost Guess active: Your next close guess within 2 letters will count as correct!";
        break;

      // --- DRAWING ---
      case "magic_brush":
        if (isDrawer) {
          this.room.broadcastCustom("evolution:effect", { type: "magic_brush", duration: 25 });
          broadcastMsg = ` ${player.name} activated Magic Rainbow Brush!`;
        } else {
          return { success: false, reason: "Only drawer can use Magic Brush" };
        }
        break;

      case "shape_assist":
        if (isDrawer) {
          state.buffs.shapeAssist = true;
          this.room.broadcastCustom("evolution:effect", { type: "shape_assist", duration: 30 });
          privateMsg = "Shape Assist active: Next strokes automatically smoothed into straight geometry.";
        } else {
          return { success: false, reason: "Only drawer can use Shape Assist" };
        }
        break;

      case "color_burst":
        state.buffs.colorBurstUntil = now + 30000;
        player.socket.emit("evolution:color_burst", { duration: 30 });
        privateMsg = "Color Burst: 6 bonus vibrant palette swatches unlocked for 30s!";
        break;

      case "perfect_line":
        if (isDrawer) {
          player.socket.emit("evolution:perfect_line", { duration: 20 });
          privateMsg = "Perfect Line primed: Click start and drag to snap a ruler-straight line.";
        } else {
          return { success: false, reason: "Only drawer can use Perfect Line" };
        }
        break;

      case "trail_brush":
        if (isDrawer) {
          this.room.broadcastCustom("evolution:effect", { type: "trail_brush", duration: 20 });
          broadcastMsg = ` ${player.name} activated Shimmering Trail Brush!`;
        }
        break;

      case "instant_clean":
        if (isDrawer && game.room.drawCommands.length > 0) {
          // Revert last 3 commands
          game.room.drawCommands = game.room.drawCommands.slice(0, Math.max(0, game.room.drawCommands.length - 3));
          this.room.broadcast({ id: 21, data: game.room.drawCommands.length });
          privateMsg = "Instant Clean: Reverted your latest 3 drawing strokes.";
        }
        break;

      // --- DEFENSE ---
      case "shield":
        state.buffs.shield = true;
        profile.stats.shieldsUsed = (profile.stats.shieldsUsed || 0) + 1;
        checkAchievements(profile);
        privateMsg = "️ Shield activated: Protected against the next steal or penalty.";
        break;

      case "second_life":
        state.buffs.shield = true;
        state.buffs.scoreLockUntil = now + 30000;
        privateMsg = "️ Second Life: Score locked and shield granted for 30 seconds.";
        break;

      case "time_guard":
        if (game.timeLeft > 0) {
          game.timeLeft = Math.min(100, game.timeLeft + 5);
          broadcastMsg = ` ${player.name} activated Time Guard (+5s added to timer)!`;
        }
        break;

      case "score_lock":
        state.buffs.scoreLockUntil = now + 45000;
        privateMsg = "Score Lock: Your score is immune to steals for 45s.";
        break;

      case "freeze_guard":
        state.buffs.freezeGuardUntil = now + 50000;
        privateMsg = "️ Freeze Guard: Immune to enemy chaos modifiers for 50s.";
        break;

      // --- CHAOS ---
      case "randomizer": {
        const mods = [
          { name: "Double XP Burst", action: () => { this.addXP(player, 15, "Randomizer Double XP"); } },
          { name: "Speed Rush (+10s)", action: () => { game.timeLeft = Math.min(90, game.timeLeft + 10); } },
          { name: "Free Letter Hint", action: () => { game.revealHint(); } }
        ];
        const chosenMod = mods[Math.floor(Math.random() * mods.length)];
        chosenMod.action();
        broadcastMsg = ` ${player.name} rolled the Randomizer: ${chosenMod.name}!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "reverse_canvas":
        this.room.broadcastCustom("evolution:effect", { type: "reverse_canvas", duration: 15 });
        broadcastMsg = ` ${player.name} reversed the drawing canvas for 15 seconds!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "chaos_brush":
        this.room.broadcastCustom("evolution:effect", { type: "chaos_brush", duration: 10 });
        broadcastMsg = `️ Chaos Brush activated by ${player.name}: Maximum brush size locked for 10s!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "time_warp": {
        const delta = Math.random() < 0.5 ? 5 : -5;
        game.timeLeft = Math.max(15, Math.min(90, game.timeLeft + delta));
        broadcastMsg = `️ ${player.name} warped time by ${delta > 0 ? "+5" : "-5"} seconds!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "ghost_canvas":
        this.room.broadcastCustom("evolution:effect", { type: "ghost_canvas", duration: 12 });
        broadcastMsg = `️ Ghost Canvas summoned by ${player.name}!`;
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "mystery_rule":
        broadcastMsg = `MYSTERY RULE: Next guesser receives +50 bonus XP and +50 points!`;
        this.pointBomb = { active: true, expiresAt: now + 20000 };
        profile.stats.chaosUsed = (profile.stats.chaosUsed || 0) + 1;
        checkAchievements(profile);
        break;

      // --- ADVANCED ---
      case "power_chain":
        state.buffs.scoreSurge = true;
        state.buffs.bullseye = true;
        privateMsg = "Power Chain: Score Surge AND Bullseye activated together!";
        break;

      case "mutation":
        privateMsg = "Mutation complete: Cooldowns refreshed and powers charged!";
        state.cooldowns.clear();
        break;

      case "evolution_choice":
        state.pendingDraft = rollDraftChoices(state.level, null, state.equippedPowers);
        privateMsg = "Evolution Choice: 3 new powers offered for draft!";
        break;

      case "power_swap": {
        const available = rollDraftChoices(state.level, null, state.equippedPowers);
        if (available.length > 0) {
          const newPower = available[0];
          state.equippedPowers = state.equippedPowers.filter(p => p !== "power_swap");
          state.equippedPowers.push(newPower.id);
          broadcastMsg = ` ${player.name} swapped power for ${newPower.name}!`;
        }
        break;
      }

      case "rare_drop": {
        const pool = Object.values(POWERS).filter(p => p.rarity === "EPIC" || p.rarity === "LEGENDARY");
        const roll = pool[Math.floor(Math.random() * pool.length)];
        if (roll) {
          if (state.equippedPowers.length >= 3) state.equippedPowers.shift();
          state.equippedPowers.push(roll.id);
          broadcastMsg = `RARE DROP! ${player.name} received ${roll.name}!`;
        }
        break;
      }

      // --- ULTIMATE POWERS ---
      case "reality_shift":
        game.timeLeft = Math.min(90, game.timeLeft + 15);
        this.pointBomb = { active: true, expiresAt: now + 15000 };
        broadcastMsg = `REALITY SHIFT! ${player.name} altered the game reality (+15s & Point Event)!`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "overdrive":
        state.buffs.overdrive = true;
        privateMsg = "OVERDRIVE ACTIVE: +50% score boost and +10 bonus XP on correct guesses!";
        broadcastMsg = ` ${player.name} entered OVERDRIVE!`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "omniscience": {
        const secret = game.secretWord || "";
        const len = secret.length;
        const chars = secret.split("").filter(c => c !== " ");
        const revealed = chars.slice(0, 3).join(", ").toUpperCase();
        privateMsg = `️ OMNISCIENCE: Letters revealed: [${revealed}], Total length: ${len}`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;
      }

      case "final_form":
        state.buffs.scoreSurge = true;
        state.buffs.doubleStrike = 2;
        state.buffs.shield = true;
        broadcastMsg = ` ${player.name} ASCENDED TO FINAL FORM! All powers unlocked for this round!`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;

      case "apocalypse":
        for (const p of this.room.players.values()) {
          p.score += 50;
        }
        game.timeLeft = Math.min(90, game.timeLeft + 10);
        broadcastMsg = `️ APOCALYPSE EVENT! +50 points to all players & +10s clock extension!`;
        profile.stats.ultimatesUsed = (profile.stats.ultimatesUsed || 0) + 1;
        checkAchievements(profile);
        break;

      default:
        break;
    }

    // Set cooldown
    const cooldownDuration = (power.cooldown || 40) * 1000;
    state.cooldowns.set(powerId, now + cooldownDuration);

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

    this.syncPlayerState(player);
    return { success: true };
  }
}

module.exports = EvolutionManager;
