const { getRandomWords } = require("../utils/words");
const { isCloseGuess } = require("../utils/levenshtein");
const db = require("../db/database");

// skribbl.io Client State Constants
const STATES = {
  WAITING: 0,     // G: "Waiting for players..."
  STARTING: 1,    // K: "Game starting in a few seconds..."
  ROUND_START: 2, // F: "Round X"
  WORD_CHOICE: 3, // V: Word picking
  DRAWING: 4,     // j: Active drawing
  REVEAL: 5,      // Z: Word reveal and turn scores
  GAME_OVER: 6,   // X: Final podium
  LOBBY: 7        // J: Room / Lobby settings
};

// End-of-turn reasons
const REASONS = {
  ALL_GUESSED: 0, // B: Everyone guessed the word!
  TIME_UP: 1,     // U: Time is up!
  DRAWER_LEFT: 2, // H: The drawer left the game!
  SKIPPED: 5      // _: Drawer got skipped!
};

// Packet IDs
const PACKETS = {
  STATE: 11,        // qa
  HINTS: 13,        // Ma
  CLOCK: 14,        // La
  CORRECT: 15,      // Da
  CLOSE: 16,        // $a
  CHAT: 30,         // Na
  CLEAR: 20,        // Ra
  SYSTEM: 31        // Wa
};

// Settings Indices
const SETTINGS = {
  LANG: 0,
  SLOTS: 1,
  DRAWTIME: 2,
  ROUNDS: 3,
  WORDCOUNT: 4,
  HINTCOUNT: 5,
  WORDMODE: 6,
  CUSTOMWORDSONLY: 7
};

class GameEngine {
  constructor(room) {
    this.room = room;
    this.state = STATES.LOBBY;
    this.currentRound = 0;
    this.totalRounds = 3;
    this.drawerQueue = [];
    this.currentDrawerId = -1;
    this.secretWord = "";
    this.wordChoices = [];
    this.hints = [];
    this.revealedHintIndices = new Set();
    this.timer = null;
    this.timeLeft = 0;
    this.roundEndsAt = 0;
    this.gameStartedAt = 0;
    this.turnStartScores = new Map();
    this.guessOrder = 0;
  }

  /**
   * Starts a new game from the lobby
   */
  start(customWordsStr = "") {
    if (this.state !== STATES.LOBBY && this.state !== STATES.GAME_OVER) return;

    this.gameStartedAt = Date.now();

    const activePlayers = this.room.getActivePlayers();
    console.log(`[GameEngine ${this.room.id}] start() called. Active players: ${activePlayers.length}`);
    if (activePlayers.length < 2) {
      // Need at least 2 players
      this.room.broadcast({
        id: PACKETS.SYSTEM,
        data: { id: 0 }
      });
      return;
    }

    if (customWordsStr && typeof customWordsStr === "string") {
      const parsed = customWordsStr.split(",").map(w => w.trim()).filter(w => w.length > 0);
      if (parsed.length >= 5) {
        this.room.customWords = parsed;
      }
    }

    this.totalRounds = parseInt(this.room.settings[SETTINGS.ROUNDS]) || 3;
    this.currentRound = 0;

    // Reset scores for all players
    for (const player of this.room.players.values()) {
      player.resetGame();
    }

    // State 1: Game starting in a few seconds...
    this.setState(STATES.STARTING, 3, 0);
    this.startTimer(3, () => {
      this.startNextRound();
    });
  }

  /**
   * Advances to next round
   */
  startNextRound() {
    this.clearTimer();
    this.currentRound++;

    if (this.currentRound > this.totalRounds) {
      this.endGame();
      return;
    }

    // Prepare drawer queue for this round
    const activePlayers = this.room.getActivePlayers();
    if (activePlayers.length < 2) {
      this.resetToLobby();
      return;
    }

    this.drawerQueue = activePlayers.map(p => p.id);

    // State 2: Round X announcement (0-indexed round number in data)
    this.setState(STATES.ROUND_START, 3, this.currentRound - 1);
    this.startTimer(3, () => {
      this.startNextTurn();
    });
  }

  /**
   * Advances to next drawing turn in current round
   */
  startNextTurn() {
    this.clearTimer();

    // Check if round finished
    if (this.drawerQueue.length === 0) {
      this.startNextRound();
      return;
    }

    const drawerId = this.drawerQueue.shift();
    const drawer = this.room.players.get(drawerId);

    // Skip if drawer disconnected
    if (!drawer || drawer.disconnected) {
      this.startNextTurn();
      return;
    }

    this.currentDrawerId = drawerId;
    this.room.drawCommands = [];
    this.room.undoHistory = [];
    this.guessOrder = 0;

    // Game Mode: Chaos Round modifier selection
    const mode = parseInt(this.room.settings[SETTINGS.WORDMODE]) || 0;
    if (mode === 5) {
      const modifiers = [
        { name: "Fast Clock!", desc: "Draw timer reduced to 25 seconds!", drawTime: 25 },
        { name: "Pure Visuals!", desc: "No letter hints will be revealed!", noHints: true },
        { name: "Double Score Round!", desc: "All points in this round are doubled!", doublePoints: true },
        { name: "Guess Rush!", desc: "First guess gets massive bonus points!", guessRush: true }
      ];
      this.chaosModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      this.room.broadcast({
        id: PACKETS.CHAT,
        data: { id: 0, msg: `CHAOS MODIFIER: ${this.chaosModifier.name} (${this.chaosModifier.desc})` }
      });
    } else {
      this.chaosModifier = null;
    }

    // Reset turn flags and snapshot scores for delta calculation
    this.turnStartScores.clear();
    for (const p of this.room.players.values()) {
      p.resetTurn();
      this.turnStartScores.set(p.id, p.score);
    }

    // Pick words for drawer
    const wordCount = parseInt(this.room.settings[SETTINGS.WORDCOUNT]) || 3;
    const lang = parseInt(this.room.settings[SETTINGS.LANG]) || 0;
    const customOnly = !!this.room.settings[SETTINGS.CUSTOMWORDSONLY];
    this.wordChoices = getRandomWords(lang, wordCount, this.room.customWords, customOnly);

    // State 3: Word choice phase (15 seconds)
    this.state = STATES.WORD_CHOICE;
    this.timeLeft = 15;

    // Send word choices only to drawer, drawer ID to others
    for (const p of this.room.players.values()) {
      if (p.id === this.currentDrawerId) {
        p.socket.emit("data", {
          id: PACKETS.STATE,
          data: {
            id: STATES.WORD_CHOICE,
            time: 15,
            data: { words: this.wordChoices }
          }
        });
      } else {
        p.socket.emit("data", {
          id: PACKETS.STATE,
          data: {
            id: STATES.WORD_CHOICE,
            time: 15,
            data: { id: this.currentDrawerId }
          }
        });
      }
    }

    // Timer for word choice
    this.startTimer(15, () => {
      // Auto-pick first word if drawer didn't choose
      this.handleWordChoice(this.currentDrawerId, 0);
    });
  }

  /**
   * Handles drawer selecting a word
   */
  handleWordChoice(playerId, wordIndex) {
    if (this.state !== STATES.WORD_CHOICE || playerId !== this.currentDrawerId) return;

    this.clearTimer();
    const chosenWord = this.wordChoices[wordIndex] || this.wordChoices[0] || "apple";
    this.startDrawingTurn(chosenWord);
  }

  /**
   * Starts active drawing phase
   */
  startDrawingTurn(word) {
    this.secretWord = word;
    this.state = STATES.DRAWING;
    let drawTime = parseInt(this.room.settings[SETTINGS.DRAWTIME]) || 80;
    const mode = parseInt(this.room.settings[SETTINGS.WORDMODE]) || 0;

    // Apply Game Mode draw time adjustments
    if (mode === 1) { // Speed Draw
      drawTime = Math.min(30, drawTime);
    } else if (mode === 5 && this.chaosModifier && this.chaosModifier.drawTime) {
      drawTime = this.chaosModifier.drawTime;
    }
    this.timeLeft = drawTime;
    this.roundEndsAt = Date.now() + (drawTime * 1000);

    // Word format for guessers: array of word lengths (e.g., "ice cream" -> [3, 5])
    const wordParts = this.secretWord.split(" ");
    const wordLengths = wordParts.map(part => part.length);

    // Hints tracking
    this.hints = [];
    this.revealedHintIndices.clear();

    // Broadcast State 4: Drawing
    for (const p of this.room.players.values()) {
      if (p.id === this.currentDrawerId) {
        p.socket.emit("data", {
          id: PACKETS.STATE,
          data: {
            id: STATES.DRAWING,
            time: this.timeLeft,
            data: {
              id: this.currentDrawerId,
              word: this.secretWord,
              hints: [],
              drawCommands: []
            }
          }
        });
      } else {
        p.socket.emit("data", {
          id: PACKETS.STATE,
          data: {
            id: STATES.DRAWING,
            time: this.timeLeft,
            data: {
              id: this.currentDrawerId,
              word: wordLengths,
              hints: [],
              drawCommands: []
            }
          }
        });
      }
    }

    // Schedule hints and clock ticks
    let maxHints = parseInt(this.room.settings[SETTINGS.HINTCOUNT]) || 2;
    if (mode === 4 || (mode === 5 && this.chaosModifier && this.chaosModifier.noHints)) {
      maxHints = 0; // Mystery Word / Chaos no hints
    }
    const hintTimes = [];
    if (maxHints > 0) {
      if (maxHints === 1) {
        hintTimes.push(Math.floor(drawTime * 0.5));
      } else {
        hintTimes.push(Math.floor(drawTime * 0.6));
        hintTimes.push(Math.floor(drawTime * 0.3));
      }
    }

    this.timer = setInterval(() => {
      this.timeLeft--;

      // Send clock tick
      this.room.broadcast({
        id: PACKETS.CLOCK,
        data: this.timeLeft
      });

      // Check hint release
      if (hintTimes.includes(this.timeLeft)) {
        this.revealHint();
      }

      if (this.timeLeft <= 0) {
        this.endTurn(REASONS.TIME_UP);
      }
    }, 1000);
  }

  /**
   * Reveals a random unrevealed letter hint
   */
  revealHint() {
    const unrevealed = [];
    for (let i = 0; i < this.secretWord.length; i++) {
      if (this.secretWord[i] !== " " && !this.revealedHintIndices.has(i)) {
        unrevealed.push(i);
      }
    }

    if (unrevealed.length > 0) {
      const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      this.revealedHintIndices.add(idx);
      const char = this.secretWord[idx];
      this.hints.push([idx, char]);

      this.room.broadcast({
        id: PACKETS.HINTS,
        data: [[idx, char]]
      });
    }
  }

  /**
   * Processes player chat input and guess attempts
   */
  handleGuess(player, text) {
    if (!text || typeof text !== "string") return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    // Outside drawing phase: standard chat
    if (this.state !== STATES.DRAWING) {
      this.room.broadcast({
        id: PACKETS.CHAT,
        data: { id: player.id, msg: trimmed }
      });
      return;
    }

    // Drawer chatting: standard chat
    if (player.id === this.currentDrawerId) {
      this.room.broadcast({
        id: PACKETS.CHAT,
        data: { id: player.id, msg: trimmed }
      });
      return;
    }

    // Player already guessed: send only to drawer and other players who guessed
    if (player.guessed) {
      for (const p of this.room.players.values()) {
        if (p.id === this.currentDrawerId || p.guessed) {
          p.socket.emit("data", {
            id: PACKETS.CHAT,
            data: { id: player.id, msg: trimmed }
          });
        }
      }
      return;
    }

    // Check exact guess
    const normalizedGuess = trimmed.toLowerCase();
    const normalizedSecret = this.secretWord.toLowerCase();
    const mode = parseInt(this.room.settings[SETTINGS.WORDMODE]) || 0;

    let isMatch = (normalizedGuess === normalizedSecret);

    // Evolution Ghost Guess check
    if (!isMatch && mode === 6 && this.room.evolution) {
      const pState = this.room.evolution.getPlayerState(player.id);
      if (pState && pState.buffs.ghostGuess && isCloseGuess(normalizedGuess, normalizedSecret)) {
        isMatch = true;
        pState.buffs.ghostGuess = false;
      }
    }

    if (isMatch) {
      // Correct guess!
      player.guessed = true;
      this.guessOrder++;

      const drawTime = parseInt(this.room.settings[SETTINGS.DRAWTIME]) || 80;
      const timeRatio = Math.max(0.1, this.timeLeft / drawTime);
      let earnedScore = Math.max(100, Math.round(500 * timeRatio));

      // Game Modes scoring adjustments
      if (mode === 3 || (mode === 5 && this.chaosModifier && this.chaosModifier.guessRush)) {
        // Guess Rush: Tiered placement rewards
        if (this.guessOrder === 1) earnedScore = Math.round(earnedScore * 1.5);
        else if (this.guessOrder === 2) earnedScore = Math.round(earnedScore * 1.25);
      }

      if (mode === 5 && this.chaosModifier && this.chaosModifier.doublePoints) {
        earnedScore *= 2;
      }

      // Evolution Mode scoring buffs
      if (mode === 6 && this.room.evolution) {
        const pState = this.room.evolution.getPlayerState(player.id);
        if (pState) {
          if (pState.buffs.scoreSurge) {
            earnedScore = Math.round(earnedScore * 1.5);
            pState.buffs.scoreSurge = false;
          }
          if (pState.buffs.doubleStrike > 0) {
            earnedScore = Math.round(earnedScore * 1.3);
            pState.buffs.doubleStrike--;
          }
          if (pState.buffs.bullseye && (drawTime - this.timeLeft) <= 15) {
            earnedScore += 100;
            pState.buffs.bullseye = false;
          }
          if (pState.buffs.overdrive) {
            earnedScore = Math.round(earnedScore * 1.5);
          }
        }
      }

      player.score += earnedScore;

      // Reward drawer as well
      const drawer = this.room.players.get(this.currentDrawerId);
      if (drawer) {
        drawer.score += Math.max(25, Math.round(earnedScore * 0.4));
      }

      // Evolution Mode: Award XP & update streaks
      if (mode === 6 && this.room.evolution) {
        this.room.evolution.onCorrectGuess(player, this.timeLeft, drawTime, this.guessOrder === 1);
        if (drawer && this.guessOrder === 1) {
          this.room.evolution.onSuccessfulDraw(drawer);
        }
      }

      // Notify guesser with secret word, and notify others
      for (const p of this.room.players.values()) {
        p.socket.emit("data", {
          id: PACKETS.CORRECT,
          data: {
            id: player.id,
            word: p.id === player.id ? this.secretWord : undefined
          }
        });
      }

      // Check if all non-drawers have guessed
      const activeGuessers = this.room.getActivePlayers().filter(p => p.id !== this.currentDrawerId);
      const allGuessed = activeGuessers.every(p => p.guessed);
      if (allGuessed) {
        this.endTurn(REASONS.ALL_GUESSED);
      }
      return;
    }

    // Check close guess
    if (isCloseGuess(normalizedGuess, normalizedSecret)) {
      player.socket.emit("data", {
        id: PACKETS.CLOSE,
        data: trimmed
      });
    }

    // Broadcast standard wrong guess to all players
    this.room.broadcast({
      id: PACKETS.CHAT,
      data: { id: player.id, msg: trimmed }
    });
  }

  /**
   * Concludes a drawing turn and reveals word & scores
   */
  endTurn(reason) {
    this.clearTimer();
    this.state = STATES.REVEAL;

    // Team Battle update
    const mode = parseInt(this.room.settings[SETTINGS.WORDMODE]) || 0;
    if (mode === 2) {
      let redTotal = 0;
      let blueTotal = 0;
      for (const p of this.room.players.values()) {
        if (p.team === "red") redTotal += p.score;
        else if (p.team === "blue") blueTotal += p.score;
      }
      this.room.broadcast({
        id: PACKETS.CHAT,
        data: { id: 0, msg: `TEAM STANDINGS: Red Team ${redTotal} pts | Blue Team ${blueTotal} pts` }
      });
    }

    // Evolution Mode turn end
    if (mode === 6 && this.room.evolution) {
      this.room.evolution.onTurnEnd();
    }

    // Build scores array: [playerId, currentTotalScore, deltaScore, ...]
    const scores = [];
    for (const p of this.room.players.values()) {
      const initial = this.turnStartScores.get(p.id) || 0;
      const delta = p.score - initial;
      scores.push(p.id, p.score, delta);
    }

    // Broadcast State 5: Reveal
    this.setState(STATES.REVEAL, 5, {
      word: this.secretWord,
      reason: reason,
      scores: scores
    });

    this.startTimer(5, () => {
      this.startNextTurn();
    });
  }

  /**
   * Concludes the entire game and presents podium
   */
  endGame() {
    this.clearTimer();
    this.state = STATES.GAME_OVER;

    // Rank players by score descending
    const sorted = this.room.getActivePlayers().sort((a, b) => b.score - a.score);
    const podiumData = sorted.map((player, index) => {
      const rank = Math.min(index, 3); // 0 = 1st, 1 = 2nd, 2 = 3rd, 3 = 4th+
      return [player.id, rank, ""];
    });

    // Evolution Mode match conclusion
    const mode = parseInt(this.room.settings[SETTINGS.WORDMODE]) || 0;
    if (mode === 6 && this.room.evolution && sorted.length > 0) {
      this.room.evolution.onMatchEnd(sorted[0].id);
    }

    // Persist match record to database
    try {
      const winner = sorted[0];
      const modeName = mode === 6 ? "evolution" : mode === 2 ? "team" : mode === 1 ? "speed" : "classic";
      db.saveMatch({
        roomId: this.room.id,
        mode: modeName,
        rounds: this.totalRounds,
        winnerId: winner ? (winner.profileId || winner.name) : null,
        winnerName: winner ? winner.name : null,
        winnerScore: winner ? winner.score : 0,
        playerCount: sorted.length,
        durationSeconds: this.gameStartedAt ? Math.round((Date.now() - this.gameStartedAt) / 1000) : 0,
        data: {
          players: sorted.map((p, idx) => ({
            id: p.id,
            profileId: p.profileId,
            name: p.name,
            score: p.score,
            position: idx + 1,
            guessedCount: p.guessedCount || 0
          }))
        }
      });
    } catch (err) {
      console.error(`[GameEngine ${this.room.id}] Failed to save match history:`, err.message);
    }

    // Broadcast State 6: Game Over / Podium (10 seconds)
    this.setState(STATES.GAME_OVER, 10, podiumData);

    this.startTimer(10, () => {
      this.resetToLobby();
    });
  }

  /**
   * Returns room to lobby state
   */
  resetToLobby() {
    this.clearTimer();
    this.state = STATES.LOBBY;
    this.currentRound = 0;
    this.currentDrawerId = -1;
    this.secretWord = "";
    this.wordChoices = [];
    this.hints = [];
    this.room.drawCommands = [];
    this.room.undoHistory = [];

    for (const p of this.room.players.values()) {
      p.resetGame();
    }

    this.setState(STATES.LOBBY, 0, 0);
  }

  /**
   * Helper to broadcast a state change to all players
   */
  setState(stateId, time, data) {
    this.state = stateId;
    this.timeLeft = time;
    this.room.broadcast({
      id: PACKETS.STATE,
      data: {
        id: stateId,
        time: time,
        data: data
      }
    });
  }

  /**
   * Handles player departure during active game
   */
  handlePlayerLeave(playerId) {
    if (this.state === STATES.DRAWING && playerId === this.currentDrawerId) {
      this.endTurn(REASONS.DRAWER_LEFT);
      return;
    }

    if (this.state === STATES.WORD_CHOICE && playerId === this.currentDrawerId) {
      this.room.broadcast({
        id: PACKETS.CHAT,
        data: { id: 0, msg: "The drawer left while choosing a word." }
      });
      this.startNextTurn();
      return;
    }

    if (this.state === STATES.DRAWING) {
      // Re-evaluate if remaining guessers have all guessed
      const activeGuessers = this.room.getActivePlayers().filter(p => p.id !== this.currentDrawerId);
      if (activeGuessers.length > 0 && activeGuessers.every(p => p.guessed)) {
        this.endTurn(REASONS.ALL_GUESSED);
      }
    }

    if (this.room.getActivePlayers().length < 2 && this.state !== STATES.LOBBY) {
      this.resetToLobby();
    }
  }

  startTimer(seconds, onFinish) {
    this.clearTimer();
    this.timeLeft = seconds;
    this.roundEndsAt = Date.now() + (seconds * 1000);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.roundEndsAt = 0;
      if (onFinish) onFinish();
    }, seconds * 1000);
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
      this.timer = null;
    }
    this.roundEndsAt = 0;
  }
}

module.exports = {
  GameEngine,
  STATES,
  REASONS,
  PACKETS,
  SETTINGS
};
