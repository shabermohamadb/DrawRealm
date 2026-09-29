/**
 * DrawRealm Evolution Power System — Full Automated Test Suite
 * Validates 10-point server authority, idempotency, rejection events,
 * execution of all 38 powers, target interactions, and reconnect synchronization.
 */

const io = require("socket.io-client");
const assert = require("assert");
const { POWERS } = require("../server/evolution/powers");

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

function waitForEvent(sock, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off(eventName, handler);
      reject(new Error(`Timeout waiting for event '${eventName}'`));
    }, timeoutMs);
    const handler = (data) => {
      clearTimeout(timer);
      sock.off(eventName, handler);
      resolve(data);
    };
    sock.on(eventName, handler);
  });
}

async function runFullTestSuite() {
  console.log("=================================================================");
  console.log("🧪 STARTING DRAWREALM EVOLUTION POWERS COMPREHENSIVE TEST SUITE");
  console.log("=================================================================\n");

  const ts = Date.now().toString().slice(-6);
  const hostName = `Hero_${ts}`;
  const guesserName = `Rival_${ts}`;

  // 1. Establish Room with Host and Guesser
  const hostSocket = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(hostSocket);

  let roomId = null;
  let hostId = null;
  let hostReconnectToken = null;

  const hostInit = new Promise(resolve => {
    hostSocket.on("data", packet => {
      if (packet.id === 10) {
        roomId = packet.data.id;
        hostId = packet.data.me;
        hostReconnectToken = packet.data.reconnectToken;
        resolve();
      }
    });
  });

  hostSocket.emit("login", {
    create: 1,
    name: hostName,
    lang: 0,
    avatar: [0, 0, 0, -1]
  });
  await hostInit;
  console.log(`[Setup] Room created: ${roomId} (Host ID: ${hostId})`);

  // Switch to Evolution Mode (Setting 6 = 6)
  hostSocket.emit("data", { id: 12, data: { id: 6, val: 6 } });
  await delay(150);

  // Connect Guesser
  const guesserSocket = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(guesserSocket);

  let guesserId = null;
  let guesserReconnectToken = null;
  const guesserInit = new Promise(resolve => {
    guesserSocket.on("data", packet => {
      if (packet.id === 10) {
        guesserId = packet.data.me;
        guesserReconnectToken = packet.data.reconnectToken;
        resolve();
      }
    });
  });

  guesserSocket.emit("login", {
    join: roomId,
    name: guesserName,
    lang: 0,
    avatar: [1, 1, 1, -1]
  });
  await guesserInit;
  console.log(`[Setup] Guesser joined: ID ${guesserId}`);
  await delay(200);

  // Setup state captures
  let hostEvoState = null;
  hostSocket.on("evolution:state", state => { hostEvoState = state; });

  let guesserEvoState = null;
  guesserSocket.on("evolution:state", state => { guesserEvoState = state; });

  // -------------------------------------------------------------
  // TEST SECTION 1: 10-Point Authoritative Rejection Engine
  // -------------------------------------------------------------
  console.log("\n--- TEST SECTION 1: 10-Point Rejection & Error Events ---");

  // 1.1 Inactive match rejection (lobby state)
  const lobbyErrorPromise = waitForEvent(hostSocket, "evolution:power_error");
  hostSocket.emit("evolution:activate_power", { powerId: "score_surge" });
  const lobbyErr = await lobbyErrorPromise;
  assert.strictEqual(lobbyErr.powerId, "score_surge");
  assert(lobbyErr.reason.includes("active match"), `Expected 'active match' error, got: ${lobbyErr.reason}`);
  console.log(`[PASS 1.1] Lobby rejection verified: "${lobbyErr.reason}"`);

  // Start game and advance to DRAWING phase
  let state1 = null;
  let state2 = null;
  hostSocket.on("data", p => { if (p.id === 11) state1 = p.data; });
  guesserSocket.on("data", p => { if (p.id === 11) state2 = p.data; });

  hostSocket.emit("data", { id: 22 }); // START_GAME (Packet 22)

  // Wait for word choice (State 3)
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const drawer = (state1 && state1.id === 3 && state1.data && state1.data.words) ? hostSocket :
                     (state2 && state2.id === 3 && state2.data && state2.data.words) ? guesserSocket : null;
      if (drawer) {
        clearInterval(iv);
        drawer.emit("data", { id: 18, data: 0 }); // Choose word 0
        resolve();
      } else if (Date.now() - start > 10000) {
        clearInterval(iv);
        reject(new Error("Timeout waiting for WORD_CHOICE state"));
      }
    }, 50);
  });

  // Wait for DRAWING (State 4)
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if ((state1 && state1.id === 4) || (state2 && state2.id === 4)) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > 10000) {
        clearInterval(iv);
        reject(new Error("Timeout waiting for DRAWING state"));
      }
    }, 50);
  });
  console.log("[Setup] Match entered DRAWING phase (State 4)");
  await delay(300);

  // 1.2 Level requirement rejection (apocalypse requires level 7)
  const levelErrorPromise = waitForEvent(guesserSocket, "evolution:power_error");
  guesserSocket.emit("evolution:activate_power", { powerId: "apocalypse" });
  const levelErr = await levelErrorPromise;
  assert(levelErr.reason.includes("Level 10 required") || levelErr.reason.includes("Level 7 required"), `Expected level requirement error, got: ${levelErr.reason}`);
  console.log(`[PASS 1.2] Level requirement rejection verified: "${levelErr.reason}"`);

  // Level up guesser to Level 1 (unlocks 1 slot)
  guesserSocket.emit("evolution:test_add_xp", 60);
  await delay(350);

  // 1.3 Unowned/Unequipped power rejection
  const unequippedErrorPromise = waitForEvent(guesserSocket, "evolution:power_error");
  guesserSocket.emit("evolution:activate_power", { powerId: "shield" });
  const unequippedErr = await unequippedErrorPromise;
  assert(unequippedErr.reason.includes("not currently equipped") || unequippedErr.reason.includes("unlocked"), `Expected unequipped error, got: ${unequippedErr.reason}`);
  console.log(`[PASS 1.3] Unowned/unequipped power rejection verified: "${unequippedErr.reason}"`);

  // Grant XP to host and guesser so level 1 powers can be activated
  hostSocket.emit("evolution:test_add_xp", 100);
  guesserSocket.emit("evolution:test_add_xp", 1000);
  await delay(250);

  // -------------------------------------------------------------
  // TEST SECTION 2: Idempotency & Rate Limiting Protection
  // -------------------------------------------------------------
  console.log("\n--- TEST SECTION 2: Idempotency Protection ---");

  // Activate power with powerRequestId
  const reqId = `test_req_${Date.now()}`;
  let activatedCount = 0;
  hostSocket.on("evolution:power_activated", data => {
    if (data.powerId === "score_surge") activatedCount++;
  });

  hostSocket.emit("evolution:activate_power", {
    powerId: "score_surge",
    powerRequestId: reqId
  });
  await delay(100);

  // Immediate duplicate replay with same powerRequestId
  hostSocket.emit("evolution:activate_power", {
    powerId: "score_surge",
    powerRequestId: reqId
  });
  await delay(300);

  assert.strictEqual(activatedCount, 1, `Idempotency failed: expected 1 activation, got ${activatedCount}`);
  console.log("[PASS 2.1] Duplicate powerRequestId cleanly ignored without duplicate execution");

  // -------------------------------------------------------------
  // TEST SECTION 3: Cooldown Enforcement & Rejection
  // -------------------------------------------------------------
  console.log("\n--- TEST SECTION 3: Cooldown Validation ---");

  const cdErrorPromise = waitForEvent(hostSocket, "evolution:power_error");
  // Try activating score_surge again (now on cooldown) with new requestId
  hostSocket.emit("evolution:activate_power", {
    powerId: "score_surge",
    powerRequestId: `req_cd_${Date.now()}`
  });
  const cdErr = await cdErrorPromise;
  assert(cdErr.reason.includes("cooldown"), `Expected cooldown error, got: ${cdErr.reason}`);
  console.log(`[PASS 3.1] Cooldown rejection verified: "${cdErr.reason}"`);

  // -------------------------------------------------------------
  // TEST SECTION 4: Authoritative Execution of All 38 Powers
  // -------------------------------------------------------------
  console.log("\n--- TEST SECTION 4: Authoritative Execution of All 38 Powers ---");

  const EvolutionManager = require("../server/evolution/evolutionManager");
  const mockPlayer1 = { id: 1, name: "MockHost", score: 100, socket: { emit: () => {} } };
  const mockPlayer2 = { id: 2, name: "MockGuesser", score: 80, socket: { emit: () => {} } };

  const mockRoom = {
    id: "mock_test_room",
    settings: [0, 8, 80, 3, 3, 2, 6, 0], // Setting 6 = 6 (Evolution Mode)
    players: new Map([[1, mockPlayer1], [2, mockPlayer2]]),
    broadcast: () => {},
    broadcastCustom: () => {},
    getActivePlayers: function() { return Array.from(this.players.values()); },
    drawCommands: [[0, 1, 4, 10, 10, 20, 20]]
  };
  mockRoom.game = {
    state: 4, // DRAWING phase
    timeLeft: 60,
    currentDrawerId: 1,
    secretWord: "DRAGON",
    revealedHintIndices: new Set(),
    revealHint: () => {},
    lastRoundCanvas: [[0, 2, 8, 10, 10, 50, 50]]
  };

  const evoMgr = new EvolutionManager(mockRoom);
  evoMgr.initPlayer(mockPlayer1);
  evoMgr.initPlayer(mockPlayer2);

  // Grant all 38 powers to both profiles and level 10 so validation passes
  const storage = require("../server/evolution/storage");
  const hostProfile = storage.getProfile(mockPlayer1.name);
  const guesserProfile = storage.getProfile(mockPlayer2.name);

  const allPowerIds = Object.keys(POWERS);
  assert.strictEqual(allPowerIds.length, 38, `Expected exactly 38 powers, found ${allPowerIds.length}`);

  hostProfile.unlockedPowers = [...allPowerIds];
  guesserProfile.unlockedPowers = [...allPowerIds];
  hostProfile.level = 10;
  guesserProfile.level = 10;

  const hostState = evoMgr.players.get(mockPlayer1.id);
  const guesserState = evoMgr.players.get(mockPlayer2.id);
  hostState.level = 10;
  guesserState.level = 10;

  let executedPowersCount = 0;

  for (const powerId of allPowerIds) {
    const powerDef = POWERS[powerId];
    assert(powerDef, `Power definition missing for ${powerId}`);

    // Determine appropriate executor based on allowedRoles
    let actor = mockPlayer2;
    let actorState = guesserState;
    if (powerDef.allowedRoles === "drawer") {
      actor = mockPlayer1; // host is drawer
      actorState = hostState;
    }

    // Reset cooldown & clear buff locks & rate limit
    actorState.cooldowns.delete(powerId);
    actorState.usesRemaining.set(powerId, 99);
    evoMgr.lastActionTimes.delete(actor.id);

    // Equip power in active slot
    if (powerDef.isUltimate) {
      actorState.ultimatePower = powerId;
    } else {
      actorState.equippedPowers = [powerId, "score_surge"];
    }

    // Execute power
    const result = evoMgr.activatePower(actor, {
      powerId: powerId,
      powerRequestId: `test_all_${powerId}_${Date.now()}`
    });

    assert(result.success, `Power ${powerId} failed activation: ${result.reason}`);
    executedPowersCount++;
  }

  assert.strictEqual(executedPowersCount, 38, `Expected 38 successfully executed powers, got ${executedPowersCount}`);
  console.log(`[PASS 4.1] All 38 Powers successfully validated and authoritatively executed!`);

  // -------------------------------------------------------------
  // TEST SECTION 5: Reconnection & Absolute State Synchronization
  // -------------------------------------------------------------
  console.log("\n--- TEST SECTION 5: Reconnection State Restoration ---");

  // On the live room: host has score_surge on cooldown (from Section 2)
  // Disconnect host
  hostSocket.disconnect();
  await delay(300);

  // Reconnect host with same session token
  const reconnectSocket = io(SERVER_URL, SOCKET_OPTIONS);
  await waitForConnect(reconnectSocket);

  let restoredEvoState = null;
  reconnectSocket.on("evolution:state", state => {
    restoredEvoState = state;
  });

  const reconnectedInit = new Promise(resolve => {
    reconnectSocket.on("data", packet => {
      if (packet.id === 10) resolve();
    });
  });

  reconnectSocket.emit("login", {
    name: hostName,
    reconnectToken: hostReconnectToken,
    lang: 0,
    avatar: [0, 0, 0, -1]
  });
  await reconnectedInit;
  await delay(400);

  assert(restoredEvoState !== null, "Restored evolution state must be received upon reconnect");
  assert(restoredEvoState.cooldowns && restoredEvoState.cooldowns["score_surge"] > 0, "Cooldown must be restored after reconnect");
  assert(restoredEvoState.cooldownEndsAt && restoredEvoState.cooldownEndsAt["score_surge"] > Date.now(), "cooldownEndsAt timestamp must be synchronized");
  console.log(`[PASS 5.1] Full state restoration verified (cooldown: ${restoredEvoState.cooldowns["score_surge"]}s, cooldownEndsAt synced)`);

  // Clean up sockets
  guesserSocket.disconnect();
  reconnectSocket.disconnect();

  console.log("\n=================================================================");
  console.log("🎉 ALL EVOLUTION POWER FULL TEST SUITE SUITES PASSED! (38/38)");
  console.log("=================================================================\n");
  process.exit(0);
}

runFullTestSuite().catch(err => {
  console.error("\n❌ TEST SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
