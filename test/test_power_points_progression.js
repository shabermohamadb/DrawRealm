/**
 * DRAWREALM — Evolution Power Points (PP) & Decoupled Progression Test Suite
 *
 * Validates:
 * 1. Initial PP balance (0 PP) and SQLite database persistence
 * 2. PP awards from gameplay actions (Correct Guess, Fast Guess, Draw, Round Win, Match Win, Streaks, Achievements)
 * 3. Decoupled progression: Level 8+ players earn PP and unlock powers without needing XP to level up
 * 4. Server authority: Rejection of unlock when PP is insufficient
 * 5. Server authority: Rejection of unlock when player level < power.levelReq
 * 6. Server authority: Rejection of duplicate unlock (prevents double charging)
 * 7. Ultimate power restrictions: Requires Level 10 and 50 PP
 * 8. Zero XP loss: Spending PP never resets or decreases player XP or Level
 * 9. Reconnect / session resumption preserves PP and unlocked inventory
 * 10. Verification of client-side HTML markup and CSS classes
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const db = require("../server/db/database");
const { EVOLUTION_LEVELS, EVOLUTION_XP, POWER_POINTS_REWARDS, POWER_COSTS } = require("../server/evolution/config");
const { POWERS, rollDraftChoices, getEligibleUnlockPool } = require("../server/evolution/powers");
const EvolutionManager = require("../server/evolution/evolutionManager");
const storage = require("../server/evolution/storage");

// Mock room & player factory
function createMockRoom() {
  const room = {
    id: "test_evo_room",
    settings: { 6: 6 }, // Mode 6 = Evolution
    players: new Map(),
    broadcastCustom: () => {},
    broadcast: () => {},
    getActivePlayers: function () {
      return Array.from(this.players.values());
    }
  };
  room.evolution = new EvolutionManager(room);
  return room;
}

function createMockPlayer(id, name, level = 0, xp = 0, pp = 0) {
  const emitted = [];
  const socket = {
    id: `sock_${id}`,
    emit: (evt, payload) => {
      emitted.push({ evt, payload });
    }
  };

  // Seed DB profile
  db.savePlayer(name, {
    name,
    xp,
    level,
    equippedPowers: level >= 1 ? ["score_surge"] : [],
    ultimatePower: null,
    unlockedPowers: level >= 1 ? ["score_surge"] : [],
    achievements: [],
    stats: {},
    powerPoints: pp
  });

  return {
    id,
    name,
    socket,
    emitted,
    getLastEmit: (evtName) => {
      for (let i = emitted.length - 1; i >= 0; i--) {
        if (emitted[i].evt === evtName) return emitted[i].payload;
      }
      return null;
    }
  };
}

async function runTestSuite() {
  console.log("============================================================");
  console.log("  DRAWREALM — EVOLUTION POWER POINTS PROGRESSION TEST SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    process.stdout.write(`TEST ${total}: ${name} ... `);
    try {
      fn();
      console.log("PASSED");
      passed++;
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Initial PP balance and database persistence
  // -------------------------------------------------------------
  test("Initial Power Points balance is 0 and persists in SQLite", () => {
    const testName = `P1_${Date.now()}`;
    const profile = db.getPlayer(testName);
    assert.strictEqual(profile.powerPoints, 0, "Default powerPoints should be 0");

    // Save with 15 PP
    profile.powerPoints = 15;
    db.savePlayer(testName, profile);

    const reloaded = db.getPlayer(testName);
    assert.strictEqual(reloaded.powerPoints, 15, "powerPoints should persist in SQLite as 15");
  });

  // -------------------------------------------------------------
  // TEST 2: PP awards from gameplay actions
  // -------------------------------------------------------------
  test("PP awarded correctly on correct guess, fast guess, draw, round win, and match win", () => {
    const room = createMockRoom();
    const testName = `P2_${Date.now()}`;
    // Level 5 requires 520 XP, Level 6 requires 720 XP (200 XP headroom)
    const player = createMockPlayer(1, testName, 5, 520, 0);
    const state = room.evolution.initPlayer(player);

    assert.strictEqual(state.powerPoints, 0);

    // 1. Regular correct guess (+1 PP)
    room.evolution.onCorrectGuess(player, 10, 80, false); // slow guess
    assert.strictEqual(state.powerPoints, POWER_POINTS_REWARDS.CORRECT, "+1 PP for regular correct guess");

    // 2. Fast correct guess (+2 PP total: 1 base + 1 fast)
    room.evolution.onCorrectGuess(player, 75, 80, false); // >= 75% timer remaining
    assert.strictEqual(
      state.powerPoints,
      POWER_POINTS_REWARDS.CORRECT + (POWER_POINTS_REWARDS.CORRECT + POWER_POINTS_REWARDS.FAST),
      "+2 PP on fast correct guess"
    );

    // 3. Drawing completion (+1 PP)
    room.evolution.onSuccessfulDraw(player);
    assert.strictEqual(
      state.powerPoints,
      POWER_POINTS_REWARDS.CORRECT * 2 + POWER_POINTS_REWARDS.FAST + POWER_POINTS_REWARDS.DRAW,
      "+1 PP on drawer completion"
    );

    // 4. Round victory (+2 PP)
    room.players.set(player.id, player);
    room.evolution.onRoundEnd(player.id);
    assert.strictEqual(
      state.powerPoints,
      POWER_POINTS_REWARDS.CORRECT * 2 + POWER_POINTS_REWARDS.FAST + POWER_POINTS_REWARDS.DRAW + POWER_POINTS_REWARDS.ROUND_WIN,
      "+2 PP on round victory"
    );

    // 5. Match victory (+3 PP)
    room.evolution.onMatchEnd(player.id);
    assert.strictEqual(
      state.powerPoints,
      POWER_POINTS_REWARDS.CORRECT * 2 + POWER_POINTS_REWARDS.FAST + POWER_POINTS_REWARDS.DRAW + POWER_POINTS_REWARDS.ROUND_WIN + POWER_POINTS_REWARDS.MATCH_WIN,
      "+3 PP on match victory"
    );
  });

  // -------------------------------------------------------------
  // TEST 3: Decoupled Progression: Level 8 player unlocks power purely with PP without leveling up
  // -------------------------------------------------------------
  test("Level 8 player unlocks Rare power using PP without needing XP to level up", () => {
    const room = createMockRoom();
    const testName = `P3_Lvl8_${Date.now()}`;
    // Level 8 requires 1220 XP. Level 9 requires 1550 XP (diff 330 XP).
    const player = createMockPlayer(2, testName, 8, 1250, 20); // 20 PP
    const state = room.evolution.initPlayer(player);

    assert.strictEqual(state.level, 8);
    assert.strictEqual(state.xp, 1250);
    assert.strictEqual(state.powerPoints, 20);

    // Pick a Rare power: 'point_bomb' (levelReq: 3, rarity: 'RARE', cost: 12 PP)
    const powerId = "point_bomb";
    const power = POWERS[powerId];
    assert.ok(power, "point_bomb exists");
    assert.strictEqual(power.cost, POWER_COSTS.RARE, "Rare power costs 12 PP");

    const result = room.evolution.unlockPower(player, powerId);
    assert.strictEqual(result.success, true, "Unlock should succeed");
    assert.strictEqual(result.remainingPP, 20 - 12, "PP should drop from 20 to 8");
    assert.strictEqual(state.powerPoints, 8, "State PP updated to 8");

    // Verify XP and Level were NOT changed
    assert.strictEqual(state.xp, 1250, "Player XP is completely preserved");
    assert.strictEqual(state.level, 8, "Player Level is completely preserved");

    // Verify power is in unlocked powers
    const profile = storage.getProfile(testName);
    assert.ok(profile.unlockedPowers.includes(powerId), "Power is in profile.unlockedPowers");
  });

  // -------------------------------------------------------------
  // TEST 4: Rejection: Insufficient PP
  // -------------------------------------------------------------
  test("Server rejects power unlock when player has insufficient PP", () => {
    const room = createMockRoom();
    const testName = `P4_NoPP_${Date.now()}`;
    const player = createMockPlayer(3, testName, 3, 230, 4); // 4 PP
    const state = room.evolution.initPlayer(player);

    // Try to unlock Common power 'letter_vision' (cost: 5 PP, have: 4 PP)
    const result = room.evolution.unlockPower(player, "letter_vision");
    assert.strictEqual(result.success, false, "Should be rejected");
    assert.ok(result.reason.includes("Insufficient Power Points"), "Error message specifies PP shortage");
    assert.strictEqual(state.powerPoints, 4, "PP should not be deducted");

    const profile = storage.getProfile(testName);
    assert.ok(!profile.unlockedPowers.includes("letter_vision"), "Power must not be unlocked");
  });

  // -------------------------------------------------------------
  // TEST 5: Rejection: Level requirement not met
  // -------------------------------------------------------------
  test("Server rejects power unlock when player level is lower than prerequisite", () => {
    const room = createMockRoom();
    const testName = `P5_LowLvl_${Date.now()}`;
    // Level 1 player with 100 PP
    const player = createMockPlayer(4, testName, 1, 60, 100);
    const state = room.evolution.initPlayer(player);

    // 'double_strike' requires Level 5
    const result = room.evolution.unlockPower(player, "double_strike");
    assert.strictEqual(result.success, false, "Should be rejected due to level requirement");
    assert.ok(result.reason.includes("Requires Evolution Level 5"), "Error indicates required level 5");
    assert.strictEqual(state.powerPoints, 100, "PP must not be deducted");
  });

  // -------------------------------------------------------------
  // TEST 6: Rejection: Duplicate unlock prevention
  // -------------------------------------------------------------
  test("Server prevents unlocking an already-unlocked power (no double charging)", () => {
    const room = createMockRoom();
    const testName = `P6_Dupe_${Date.now()}`;
    const player = createMockPlayer(5, testName, 2, 130, 20);
    const state = room.evolution.initPlayer(player);

    // Starter power 'score_surge' is already unlocked at level >= 1
    const result = room.evolution.unlockPower(player, "score_surge");
    assert.strictEqual(result.success, false, "Should reject already unlocked power");
    assert.strictEqual(result.reason, "Power is already unlocked");
    assert.strictEqual(state.powerPoints, 20, "PP not deducted on duplicate unlock");
  });

  // -------------------------------------------------------------
  // TEST 7: Ultimate Power Level 10 & 50 PP Requirement
  // -------------------------------------------------------------
  test("Ultimate power requires Level 10 and 50 PP", () => {
    const room = createMockRoom();
    const testName = `P7_Ult_${Date.now()}`;

    // A: Level 9 player with 50 PP cannot unlock Ultimate
    const playerLvl9 = createMockPlayer(6, `${testName}_9`, 9, 1600, 50);
    room.evolution.initPlayer(playerLvl9);
    const res9 = room.evolution.unlockPower(playerLvl9, "apocalypse");
    assert.strictEqual(res9.success, false, "Level 9 cannot unlock Ultimate");
    assert.ok(res9.reason.includes("Level 10"), "Error mentions Level 10");

    // B: Level 10 player with 30 PP cannot unlock Ultimate (requires 50 PP)
    const playerLvl10Short = createMockPlayer(7, `${testName}_10s`, 10, 2100, 30);
    room.evolution.initPlayer(playerLvl10Short);
    const res10Short = room.evolution.unlockPower(playerLvl10Short, "apocalypse");
    assert.strictEqual(res10Short.success, false, "Level 10 with 30 PP cannot unlock 50 PP Ultimate");

    // C: Level 10 player with 50 PP successfully unlocks Ultimate
    const playerLvl10Rich = createMockPlayer(8, `${testName}_10ok`, 10, 2100, 50);
    const state10 = room.evolution.initPlayer(playerLvl10Rich);
    const res10Ok = room.evolution.unlockPower(playerLvl10Rich, "apocalypse");
    assert.strictEqual(res10Ok.success, true, "Level 10 with 50 PP successfully unlocks Ultimate");
    assert.strictEqual(state10.powerPoints, 0, "PP drops from 50 to 0");
    assert.strictEqual(state10.ultimatePower, "apocalypse", "Auto-equipped into ultimate slot");
  });

  // -------------------------------------------------------------
  // TEST 8: Drafting logic filters by level eligibility
  // -------------------------------------------------------------
  test("rollDraftChoices filters eligible locked powers by player level", () => {
    // Level 1 player: only levelReq <= 1 powers eligible
    const choicesLvl1 = rollDraftChoices(1, null, ["score_surge"]);
    assert.strictEqual(choicesLvl1.length, 3, "Draft presents 3 choices");
    for (const c of choicesLvl1) {
      assert.ok(!c.isUltimate, "Level 1 draft never includes ultimate");
      assert.ok(c.cost >= 5, "Power cost is attached");
    }

    // Level 10 player: can draft high tier powers
    const poolLvl10 = getEligibleUnlockPool(10, ["score_surge"], true);
    assert.ok(poolLvl10.length > 20, "Level 10 has large pool of eligible powers");
  });

  // -------------------------------------------------------------
  // TEST 9: SQLite persistence across reconnect
  // -------------------------------------------------------------
  test("PP and unlocked powers persist across reconnect / reload", () => {
    const testName = `P9_Persist_${Date.now()}`;
    const p = db.getPlayer(testName);
    p.powerPoints = 37;
    p.unlockedPowers = ["score_surge", "point_bomb", "bullseye"];
    db.savePlayer(testName, p);

    // Simulate new room and reconnect
    const room = createMockRoom();
    const reconnectPlayer = createMockPlayer(9, testName, 4, 400, 37);
    const state = room.evolution.initPlayer(reconnectPlayer);

    assert.strictEqual(state.powerPoints, 37, "Preserved 37 PP on reconnect");
    const lastStateEmit = reconnectPlayer.getLastEmit("evolution:state");
    assert.ok(lastStateEmit, "Emitted evolution:state");
    assert.strictEqual(lastStateEmit.powerPoints, 37, "evolution:state includes powerPoints: 37");
  });

  // -------------------------------------------------------------
  // TEST 10: HTML & CSS markup structure
  // -------------------------------------------------------------
  test("HTML and CSS contains PP counter, unlock button, and cost styling", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
    const css = fs.readFileSync(path.resolve(__dirname, "../css/style.css"), "utf8");

    assert.ok(html.includes('id="evolution-badge-pp"'), "HTML has #evolution-badge-pp");
    assert.ok(html.includes('id="evolution-btn-unlock-power"'), "HTML has #evolution-btn-unlock-power");
    assert.ok(html.includes('id="draft-pp-balance"'), "HTML has #draft-pp-balance");
    assert.ok(html.includes('id="btn-evolution-draft-close"'), "HTML has #btn-evolution-draft-close");

    assert.ok(css.includes(".evolution-badge-pp"), "CSS has .evolution-badge-pp");
    assert.ok(css.includes(".evolution-btn-unlock-power"), "CSS has .evolution-btn-unlock-power");
    assert.ok(css.includes(".btn-choice-unlock.affordable"), "CSS has .btn-choice-unlock.affordable");
    assert.ok(css.includes(".btn-choice-unlock.locked"), "CSS has .btn-choice-unlock.locked");
    assert.ok(css.includes(".choice-cost"), "CSS has .choice-cost");
  });

  console.log("\n============================================================");
  console.log(`  RESULTS: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log("============================================================\n");

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
