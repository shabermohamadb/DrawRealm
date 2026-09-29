/**
 * Automated Test Suite: Evolution Power UI/UX Lifecycle & Network Protocol
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
  console.log("=== RUNNING EVOLUTION POWERS UI/UX PROTOCOL TESTS ===");

  const timestamp = Date.now();
  const hostName = `EvoHost_${timestamp}`;
  const guesserName = `EvoGuesser_${timestamp}`;

  const client1 = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(client1);
  console.log("[Test] Host connected, socket ID:", client1.id);

  let roomId = null;
  let hostPlayerId = null;

  const hostInitPromise = new Promise((resolve) => {
    client1.on("data", (packet) => {
      if (packet.id === 10) { // ROOM_INIT
        roomId = packet.data.id;
        hostPlayerId = packet.data.me;
        resolve();
      }
    });
  });

  client1.emit("login", {
    create: 1,
    name: hostName,
    lang: 0,
    avatar: [0, 0, 0, -1]
  });

  await hostInitPromise;
  console.log(`[Test] Room created: ${roomId}, Host ID: ${hostPlayerId}`);

  // Set Evolution Mode (Setting 6 = 6)
  client1.emit("data", {
    id: 12, // SETTINGS
    data: { id: 6, val: 6 }
  });
  await delay(200);

  // 2. Connect Client 2 (Guesser/Opponent)
  const client2 = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(client2);

  let guesserPlayerId = null;
  const guesserInitPromise = new Promise((resolve) => {
    client2.on("data", (packet) => {
      if (packet.id === 10) {
        guesserPlayerId = packet.data.me;
        resolve();
      }
    });
  });

  client2.emit("login", {
    join: roomId,
    name: guesserName,
    lang: 0,
    avatar: [1, 1, 1, -1]
  });

  await guesserInitPromise;
  console.log(`[Test] Guesser connected, ID: ${guesserPlayerId}`);

  try {
    // 3. Award XP to Host to level up to Level 2 (Swift) -> 2 power slots
    let hostEvoState = null;
    client1.on("evolution:state", (state) => {
      hostEvoState = state;
    });

    // Add 150 XP to trigger Level 2 (Swift unlocks at 120 XP, Creator at 220 XP)
    client1.emit("evolution:test_add_xp", 150);
    await delay(350);

    assert(hostEvoState !== null, "Host should have received evolution:state");
    assert.strictEqual(hostEvoState.isEvolutionMode, true, "Should be in Evolution Mode");
    assert.strictEqual(hostEvoState.level, 2, `Host should be Level 2 (got ${hostEvoState.level})`);
    assert.strictEqual(hostEvoState.maxPowers, 2, "Level 2 should provide maxPowers = 2");
    assert.strictEqual(hostEvoState.hasUltimate, false, "Level 2 should not have ultimate slot unlocked");
    console.log("[Test PASS] Level 2 progression & slot limits verified (maxPowers: 2, hasUltimate: false)");

    // 4. Test Starter power automatically equipped in slot 0
    assert(hostEvoState.equippedPowers.some(p => p.id === "score_surge"), "Slot 0 should have starter power score_surge");
    console.log("[Test PASS] Starter power automatically equipped and in unlockedPowers collection");

    // 5. Test Unequip Power
    console.log("[Test] Unequipping score_surge from slot 0...");
    client1.emit("evolution:unequip_power", { powerId: "score_surge" });
    await delay(250);

    assert(!hostEvoState.equippedPowers.some(p => p.id === "score_surge"), "score_surge should no longer be equipped");
    assert(hostEvoState.unlockedPowers.some(p => p.id === "score_surge"), "score_surge MUST remain unlocked in collection after unequip");
    console.log("[Test PASS] Unequip verified: slot emptied and power preserved in collection");

    // 6. Test Re-Equipping from Collection into Slot 0
    console.log("[Test] Re-equipping score_surge into slot 0...");
    client1.emit("evolution:equip_power", { powerId: "score_surge", slot: 0 });
    await delay(250);

    assert(hostEvoState.equippedPowers.some(p => p.id === "score_surge"), "score_surge should be re-equipped into slot 0");
    console.log("[Test PASS] Re-equipping power into empty slot verified");

    // 7. Test Power Activation & Broadcast (evolution:power_used)
    // Register listener for word choice (packet 18)
    const wordChoicePromise = new Promise((resolve) => {
      client1.on("data", (packet) => {
        // packet 18 with words array sent to current drawer
        if (packet.id === 18 && Array.isArray(packet.data)) {
          resolve(packet.data);
        }
      });
    });

    console.log("[Test] Starting game to reach DRAWING phase...");
    client1.emit("data", { id: 22 }); // START_GAME

    console.log("[Test] Waiting for round countdown and word choice...");
    const words = await wordChoicePromise;
    console.log("[Test] Word choices received:", words);

    // Host selects first word (index 0)
    const drawingStatePromise = new Promise((resolve) => {
      client1.on("data", (packet) => {
        // packet 16 or state change to DRAWING (4)
        if (packet.id === 16 && packet.data && packet.data.id === 4) {
          resolve();
        }
      });
    });

    client1.emit("data", { id: 18, data: 0 });
    await drawingStatePromise;
    console.log("[Test] Game is now in DRAWING phase (state 4)!");

    let powerUsedEventReceivedByHost = null;
    let powerUsedEventReceivedByGuesser = null;

    client1.on("evolution:power_used", (data) => {
      powerUsedEventReceivedByHost = data;
    });

    client2.on("evolution:power_used", (data) => {
      powerUsedEventReceivedByGuesser = data;
    });

    console.log("[Test] Activating power 'score_surge'...");
    client1.emit("evolution:activate_power", "score_surge");
    await delay(500);

    assert(powerUsedEventReceivedByHost !== null, "Host should receive evolution:power_used broadcast");
    assert(powerUsedEventReceivedByGuesser !== null, "Guesser should receive evolution:power_used broadcast");
    assert.strictEqual(powerUsedEventReceivedByGuesser.powerId, "score_surge");
    assert.strictEqual(powerUsedEventReceivedByGuesser.powerName, "Score Surge");
    assert.strictEqual(powerUsedEventReceivedByGuesser.playerId, hostPlayerId);
    assert.strictEqual(powerUsedEventReceivedByGuesser.powerBranch, "attack");
    console.log("[Test PASS] evolution:power_used room-wide broadcast verified with verified metadata");

    // 8. Cooldown state verified on slot
    assert(hostEvoState.cooldowns && hostEvoState.cooldowns["score_surge"] > 0, "score_surge should have active cooldown");
    console.log(`[Test PASS] Active cooldown verified: ${hostEvoState.cooldowns["score_surge"]}s`);

    console.log("\n==========================================");
    console.log("ALL 8 EVOLUTION POWER UI/UX TESTS PASSED!");
    console.log("==========================================\n");

  } finally {
    client1.disconnect();
    client2.disconnect();
  }
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
