/**
 * DrawRealm Authoritative Scoring Engine
 * Centralized, deterministic scoring calculations, power multipliers,
 * drawer rewards, and atomic score updates with audit logging.
 */

/**
 * Calculates guess points with deterministic formulas, placement decay,
 * speed bonus, mode modifiers, and bounded power buffs.
 *
 * @param {Object} params
 * @param {number} params.timeLeft - Seconds remaining on the clock
 * @param {number} params.totalDrawTime - Total draw duration in seconds
 * @param {number} params.guessOrder - 1-based order of correct guess (1 = first)
 * @param {number} [params.mode=0] - Active Word Mode (0=Normal, 1=Speed, 2=Team, 3=Rush, 4=Mystery, 5=Chaos, 6=Evolution)
 * @param {Object} [params.chaosModifier=null] - Round chaos modifier if active
 * @param {Object} [params.buffs=null] - Player's active evolution buffs
 * @param {boolean} [params.pointBombActive=false] - Whether a Point Bomb / Mystery Rule bonus is primed
 * @returns {Object} { totalScore, baseScore, speedBonus, rushBonus, powerBonus, pointBombBonus, consumedBuffs }
 */
function calculateGuessPoints({
  timeLeft,
  totalDrawTime,
  guessOrder = 1,
  mode = 0,
  chaosModifier = null,
  buffs = null,
  pointBombActive = false
}) {
  const safeDrawTime = Math.max(1, totalDrawTime || 80);
  const safeTimeLeft = Math.max(0, Math.min(safeDrawTime, timeLeft || 0));

  // 1. Time Ratio (strictly bounded 0.1 to 1.0)
  const timeRatio = Math.max(0.1, Math.min(1.0, safeTimeLeft / safeDrawTime));

  // 2. Base First-Guesser Points (100 to 500)
  const baseFirstGuesser = Math.max(100, Math.round(500 * timeRatio));

  // 3. Decaying Factor for Subsequent Guessers (decay by 15% per position, minimum 50% of first)
  const decayFactor = guessOrder === 1 ? 1.0 : Math.max(0.5, 1.0 - (guessOrder - 1) * 0.15);
  let baseScore = Math.max(50, Math.round(baseFirstGuesser * decayFactor));

  // 4. Bounded Speed Bonus: +50 pts if guessed within the first 25% of the round (timeRatio >= 0.75)
  let speedBonus = 0;
  if (timeRatio >= 0.75) {
    speedBonus = 50;
  }

  // 5. Game Mode Multipliers (Guess Rush & Chaos Double Points)
  let modeMultiplier = 1.0;
  let rushBonus = 0;

  const isGuessRush = mode === 3 || (mode === 5 && chaosModifier && chaosModifier.guessRush);
  if (isGuessRush) {
    if (guessOrder === 1) rushBonus = Math.round(baseScore * 0.5); // +50%
    else if (guessOrder === 2) rushBonus = Math.round(baseScore * 0.25); // +25%
  }

  if (mode === 5 && chaosModifier && chaosModifier.doublePoints) {
    modeMultiplier *= 2.0;
  }

  // Subtotal before evolution powers
  let currentScore = Math.round((baseScore + speedBonus + rushBonus) * modeMultiplier);

  // 6. Evolution Power Buffs
  const consumedBuffs = {
    scoreSurge: false,
    doubleStrike: false,
    bullseye: false,
    pointBomb: false
  };

  let powerMultiplier = 1.0;
  let flatPowerBonus = 0;

  if (buffs) {
    // Score Surge: 1.5x (applies once, consumed immediately)
    if (buffs.scoreSurge) {
      powerMultiplier *= 1.5;
      consumedBuffs.scoreSurge = true;
    }

    // Double Strike: 1.3x (applies once per charge, decremented)
    if (buffs.doubleStrike && buffs.doubleStrike > 0) {
      powerMultiplier *= 1.3;
      consumedBuffs.doubleStrike = true;
    }

    // Bullseye: +100 flat bonus if guessed within first 15 seconds
    const elapsedSeconds = safeDrawTime - safeTimeLeft;
    if (buffs.bullseye && elapsedSeconds <= 15) {
      flatPowerBonus += 100;
      consumedBuffs.bullseye = true;
    }

    // Overdrive Ultimate: 1.5x (persists for the round)
    if (buffs.overdrive) {
      powerMultiplier *= 1.5;
    }
  }

  // Hard Cap on Stacking Multipliers: Maximum 3.0x power multiplier
  powerMultiplier = Math.min(3.0, powerMultiplier);

  const powerScore = Math.round(currentScore * powerMultiplier) - currentScore + flatPowerBonus;
  currentScore = Math.round(currentScore * powerMultiplier) + flatPowerBonus;

  // 7. Point Bomb / Mystery Rule Bonus (+100 flat bonus)
  let pointBombBonus = 0;
  if (pointBombActive) {
    pointBombBonus = 100;
    currentScore += pointBombBonus;
    consumedBuffs.pointBomb = true;
  }

  const finalTotal = Math.max(50, Math.round(currentScore));

  return {
    totalScore: finalTotal,
    baseScore,
    speedBonus,
    rushBonus,
    powerMultiplier,
    powerBonus: powerScore,
    bullseyeBonus: flatPowerBonus,
    pointBombBonus,
    consumedBuffs
  };
}

/**
 * Calculates drawer points based on the guesser's score, drawer buffs,
 * and active Point Bomb events.
 *
 * @param {Object} params
 * @param {number} params.baseGuesserScore - Base score of the guesser (unmodified by guesser powers)
 * @param {number} [params.guessOrder=1] - Guess sequence position
 * @param {Object} [params.drawerBuffs=null] - Drawer's active buffs
 * @param {boolean} [params.pointBombActive=false] - Whether Point Bomb is active
 * @returns {Object} { totalScore, consumedBuffs }
 */
function calculateDrawerPoints({
  baseGuesserScore,
  guessOrder = 1,
  drawerBuffs = null,
  pointBombActive = false
}) {
  // Base drawer reward is 40% of guesser's score (min 25)
  let drawerScore = Math.max(25, Math.round(baseGuesserScore * 0.4));

  const consumedBuffs = {
    scoreSurge: false
  };

  // Drawer Score Surge: +50% reward
  if (drawerBuffs && drawerBuffs.scoreSurge) {
    drawerScore = Math.round(drawerScore * 1.5);
    consumedBuffs.scoreSurge = true;
  }

  // Drawer Point Bomb share (+50 pts)
  if (pointBombActive) {
    drawerScore += 50;
  }

  return {
    totalScore: Math.max(25, Math.round(drawerScore)),
    consumedBuffs
  };
}

/**
 * Atomically updates player score, logs the structured audit entry,
 * and broadcasts an authoritative real-time score sync to the room.
 *
 * @param {Object} room - The game room instance
 * @param {Object} player - The player instance
 * @param {number} delta - Point adjustment (can be positive or negative)
 * @param {string} reason - Descriptive audit rationale
 * @returns {number} The new authoritative total score
 */
function applyScoreChange(room, player, delta, reason = "Unspecified") {
  if (!player || !room) return 0;

  const oldScore = typeof player.score === "number" ? player.score : 0;
  const safeDelta = Math.round(delta || 0);
  const newScore = Math.max(0, oldScore + safeDelta);

  // Authoritative assignment
  player.score = newScore;

  // Structured server score audit log
  console.log(
    `[SCORE] Room: ${room.id} | Player: ${player.id} (${player.name}) | Reason: ${reason} | Old: ${oldScore} | Delta: ${safeDelta >= 0 ? "+" + safeDelta : safeDelta} | New: ${newScore}`
  );

  // Broadcast real-time score sync to all clients in the room
  try {
    room.broadcastCustom("evolution:score_sync", {
      playerId: player.id,
      score: newScore,
      delta: safeDelta,
      reason
    });
  } catch (err) {
    // If room or broadcastCustom unavailable, continue safely
  }

  return newScore;
}

module.exports = {
  calculateGuessPoints,
  calculateDrawerPoints,
  applyScoreChange
};
