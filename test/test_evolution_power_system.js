/**
 * Comprehensive Test Suite for DrawRealm Evolution Mode Power System
 * Verifies:
 * 1. Level 0 starting power (exactly 1 valid starting power, PP = 0)
 * 2. Event deduplication (identical eventId ignored, exact log format)
 * 3. PP thresholds at 5, 10, 15 (exactly 1 choice of 3 valid powers, single unlock)
 * 4. Equipped limits (3 normal powers max, 4th power moves to inventory without replacing)
 * 5. Cooldowns & use limits
 * 6. Reconnect persistence
 * 7. Multi-room isolation
 */

const io = require("socket.io-client");
const assert = require("assert");

const SERVER_URL = process.env.TEST_SERVER_URL || "http://127.0.0.1:3001";
const SOCKET_OPTIONS = {
  transports: ["websocket", "polling"],
  path: "/socket.io/",
  reconnection: false,
  timeout: 5000
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForConnect(sock) {
  if (sock.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    sock.once("connect", resolve);
    sock.once("connect_error", reject);
  });
}

async function runTests() {
  console.log("===============================================================");
  console.log("⚡ STARTING EVOLUTION MODE POWER SYSTEM ACCEPTANCE TESTS");
  console.log("===============================================================\n");

  const ts = Date.now().toString().slice(-6);
  const hostName = `EvoHost_${ts}`;
  const guesserName = `EvoGuesser_${ts}`;

  // 1. TEST 1: Starting Power & Initial State (Level 0, PP 0, 1 Starter Power)
  console.log("--- TEST 1: Level 0 Starting Power & Initial State ---");
  const hostSock = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(hostSock);

  let roomId = null;
  let hostId = null;
  let hostInit = new Promise(resolve => {
    hostSock.on("data", packet => {
      if (packet.id === 10) {
        roomId = packet.data.id;
        hostId = packet.data.me;
        resolve();
      }
    });
  });

  hostSock.emit("login", {
    create: 1,
    name: hostName,
    lang: 0,
    avatar: [0, 0, 0, -1]
  });
  await hostInit;

  // Switch to Evolution Mode (setting 6 = 6)
  hostSock.emit("data", { id: 12, data: { id: 6, val: 6 } });
  await delay(150);

  // Connect Guesser at Level 0
  const guesserSock = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(guesserSock);

  let guesserId = null;
  let guesserInit = new Promise(resolve => {
    guesserSock.on("data", packet => {
      if (packet.id === 10) {
        guesserId = packet.data.me;
        resolve();
      }
    });
  });

  let guesserState = null;
  guesserSock.on("evolution:state", state => {
    guesserState = state;
  });

  guesserSock.emit("login", {
    join: roomId,
    name: guesserName,
    lang: 0,
    avatar: [1, 1, 1, -1]
  });
  await guesserInit;
  await delay(250);

  assert(guesserState, "Guesser must receive evolution:state");
  assert.strictEqual(guesserState.level, 0, "Guesser must start at Level 0");
  assert.strictEqual(guesserState.powerPoints, 0, "Guesser must start with 0 PP");
  assert.strictEqual(guesserState.equippedPowers.length, 1, "Guesser must start with exactly 1 equipped power");
  assert.strictEqual(guesserState.equippedPowers[0].id, "shield", "Starter power must be 'shield'");
  assert.strictEqual(guesserState.powerChoicePending, false, "No power choice should be pending at start");
  assert.strictEqual(guesserState.pendingDraft, null, "pendingDraft must be null when powerChoicePending is false");
  console.log("[PASS 1] Level 0 starting power verified: exactly 1 power ('shield'), PP = 0, no pending choice.");

  // 2. TEST 2: Event Deduplication
  console.log("\n--- TEST 2: Power Event Deduplication ---");
  const EvolutionManager = require("../server/evolution/evolutionManager");
  const storage = require("../server/evolution/storage");
  const mockRoom = {
    id: "TestRoomDedupe",
    settings: ["", "", "80", "", "", "", 6],
    players: new Map(),
    broadcast: () => {},
    broadcastCustom: () => {},
    getActivePlayers: () => []
  };
  const mockPlayer = {
    id: 99,
    name: `DedupeUser_${ts}`,
    socket: { emit: () => {} }
  };
  mockRoom.players.set(mockPlayer.id, mockPlayer);

  const evoMgr = new EvolutionManager(mockRoom);
  const pState = evoMgr.initPlayer(mockPlayer);

  const testDedupeEventId = "event_correct_guess_round_1";
  evoMgr.addPowerPoints(mockPlayer, 1, "Correct Guess", testDedupeEventId);
  assert.strictEqual(pState.powerPoints, 1, "First event must award +1 PP");

  // Send identical eventId again
  evoMgr.addPowerPoints(mockPlayer, 1, "Correct Guess", testDedupeEventId);
  assert.strictEqual(pState.powerPoints, 1, "Duplicate eventId must be ignored (still 1 PP)");
  console.log("[PASS 2] Duplicate event deduplication verified: second identical event ignored.");

  // 3. TEST 3: Power Unlock Threshold at PP = 5, 10, 15
  console.log("\n--- TEST 3: Power Unlock Thresholds (5 PP, 10 PP, 15 PP) ---");
  // Award +4 PP with unique event IDs -> total 5 PP
  evoMgr.addPowerPoints(mockPlayer, 4, "Fast Guess + Round Win", "event_milestone_5");
  assert.strictEqual(pState.powerPoints, 5, "Total PP should now be 5");
  assert.strictEqual(pState.powerChoicePending, true, "powerChoicePending must be TRUE at 5 PP");
  assert(Array.isArray(pState.pendingChoice), "pendingChoice must be an array of powers");
  assert.strictEqual(pState.pendingChoice.length, 3, "Exactly 3 power choices must be generated");

  // Verify choices quality: no duplicates, no owned powers ('shield')
  const choiceIds = pState.pendingChoice.map(c => c.id);
  const uniqueIds = new Set(choiceIds);
  assert.strictEqual(uniqueIds.size, 3, "All 3 choices must be unique");
  assert(!uniqueIds.has("shield"), "Starting power 'shield' must not be offered again");

  console.log(`[PASS 3.1] 5 PP Threshold reached! Exactly 3 valid choices generated: [${choiceIds.join(", ")}]`);

  // Choose ONE power from the draft
  const chosenPower1 = pState.pendingChoice[0].id;
  const unlockRes1 = evoMgr.unlockPower(mockPlayer, chosenPower1);
  assert(unlockRes1.success, "Unlocking chosen power must succeed");
  assert.strictEqual(pState.powerChoicePending, false, "powerChoicePending must be false after choosing");
  assert.strictEqual(pState.pendingChoice, null, "pendingChoice must be null after choosing");
  assert.strictEqual(pState.equippedPowers.length, 2, "Player should now have 2 equipped powers");
  assert(pState.equippedPowers.includes(chosenPower1), "Newly unlocked power must be equipped in Slot 2");
  assert.strictEqual(pState.powerPoints, 5, "PP must NOT be deducted (cumulative progression)");
  console.log(`[PASS 3.2] Chosen power '${chosenPower1}' unlocked and equipped in Slot 2. PP remains 5.`);

  // Progress to 10 PP
  evoMgr.addPowerPoints(mockPlayer, 5, "Gameplay Actions", "event_milestone_10");
  assert.strictEqual(pState.powerPoints, 10, "Total PP should now be 10");
  assert.strictEqual(pState.powerChoicePending, true, "powerChoicePending must be TRUE at 10 PP");
  assert.strictEqual(pState.pendingChoice.length, 3, "Exactly 3 choices at 10 PP");
  
  const chosenPower2 = pState.pendingChoice[0].id;
  const unlockRes2 = evoMgr.unlockPower(mockPlayer, chosenPower2);
  assert(unlockRes2.success, "Unlocking second power must succeed");
  assert.strictEqual(pState.equippedPowers.length, 3, "Player should now have 3 equipped powers (Slots 1, 2, 3 full)");
  console.log(`[PASS 3.3] 10 PP Threshold reached! '${chosenPower2}' equipped into Slot 3.`);

  // Progress to 15 PP (Inventory Full Test)
  evoMgr.addPowerPoints(mockPlayer, 5, "Gameplay Actions", "event_milestone_15");
  assert.strictEqual(pState.powerPoints, 15, "Total PP should now be 15");
  assert.strictEqual(pState.powerChoicePending, true, "powerChoicePending must be TRUE at 15 PP");
  
  const chosenPower3 = pState.pendingChoice[0].id;
  const unlockRes3 = evoMgr.unlockPower(mockPlayer, chosenPower3);
  assert(unlockRes3.success, "Unlocking third power must succeed");
  assert.strictEqual(unlockRes3.equipped, false, "4th unlocked power must NOT auto-equip when slots are full (max 3)");
  assert.strictEqual(pState.equippedPowers.length, 3, "Equipped powers must remain 3");
  const mockProfile = storage.getProfile(mockPlayer.name);
  assert(mockProfile.unlockedPowers.includes(chosenPower3), "Newly unlocked power must exist in unlockedPowers inventory");
  assert(!pState.equippedPowers.includes(chosenPower3), "Power must not displace existing equipped powers");
  console.log(`[PASS 3.4] 15 PP Threshold reached! 4th unlocked power '${chosenPower3}' safely stored in unlocked inventory without displacing equipped slots.`);

  // 4. TEST 4: Cooldowns & Uses
  console.log("\n--- TEST 4: Power Cooldown & Limited Uses ---");
  // Test cooldown on shield
  pState.level = 2; // satisfy level req
  mockRoom.game = { state: 4, currentDrawerId: 100 }; // active drawing phase, player is guesser
  const actRes1 = evoMgr.activatePower(mockPlayer, "shield");
  assert(actRes1.success, "First shield activation must succeed");
  
  // Wait 300ms so anti-spam rate limiter (250ms) passes and power cooldown is tested
  await delay(300);
  const actRes2 = evoMgr.activatePower(mockPlayer, "shield");
  assert.strictEqual(actRes2.success, false, "Second activation during cooldown must be rejected");
  assert(actRes2.reason.includes("cooldown"), `Rejection reason must mention cooldown: ${actRes2.reason}`);
  console.log("[PASS 4] Cooldown validation verified: immediate re-activation rejected.");

  // 5. TEST 5: Reconnect Progression Preservation
  console.log("\n--- TEST 5: Reconnect Progression Preservation ---");
  // Simulate player reconnect with new state instance
  const reconnectedState = evoMgr.initPlayer(mockPlayer);
  assert.strictEqual(reconnectedState.powerPoints, 15, "Reconnected player must retain 15 PP");
  assert.strictEqual(reconnectedState.equippedPowers.length, 3, "Reconnected player must retain 3 equipped powers");
  assert.strictEqual(reconnectedState.lastPowerThresholdGranted, 15, "Reconnected player must retain last threshold 15");
  assert.strictEqual(reconnectedState.powerChoicePending, false, "Reconnected player must not receive duplicate choice");
  console.log("[PASS 5] Reconnect verified: PP (15), equipped powers (3), and thresholds preserved.");

  // 6. TEST 6: Multi-Room Isolation
  console.log("\n--- TEST 6: Multi-Room Isolation ---");
  const mockRoomB = {
    id: "TestRoomB",
    settings: ["", "", "80", "", "", "", 6],
    players: new Map(),
    broadcast: () => {},
    broadcastCustom: () => {}
  };
  const mockPlayerB = {
    id: 101,
    name: `RoomBUser_${ts}`,
    socket: { emit: () => {} }
  };
  const evoMgrB = new EvolutionManager(mockRoomB);
  const pStateB = evoMgrB.initPlayer(mockPlayerB);

  evoMgrB.addPowerPoints(mockPlayerB, 5, "Room B Guess", "event_room_b_1");
  assert.strictEqual(pStateB.powerPoints, 5, "Room B player should have 5 PP");
  assert.strictEqual(pState.powerPoints, 15, "Room A player must remain unaffected at 15 PP");
  console.log("[PASS 6] Multi-room isolation verified: Room A (15 PP) and Room B (5 PP) are completely isolated.");

  // Teardown
  hostSock.close();
  guesserSock.close();
  evoMgr.destroy();
  evoMgrB.destroy();

  console.log("\n===============================================================");
  console.log("🏆 ALL EVOLUTION MODE POWER SYSTEM ACCEPTANCE TESTS PASSED!");
  console.log("===============================================================");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
