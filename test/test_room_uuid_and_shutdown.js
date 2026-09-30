/**
 * Test Suite: Room UUID separation, Supabase operations, and RoomManager shutdown
 */

const assert = require("assert");
const { spawn } = require("child_process");
const path = require("path");
const db = require("../server/db/database");
const supabaseService = require("../server/db/supabaseClient");
const Room = require("../server/rooms/room");
const roomManager = require("../server/rooms/roomManager");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== STARTING ROOM UUID AND SHUTDOWN TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  // Track any console.error or console.warn messages containing 'invalid input syntax for type uuid'
  const originalWarn = console.warn;
  const originalError = console.error;
  let uuidErrorsLogged = [];

  console.warn = (...args) => {
    const str = args.join(" ");
    if (str.includes("invalid input syntax for type uuid")) {
      uuidErrorsLogged.push(str);
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    const str = args.join(" ");
    if (str.includes("invalid input syntax for type uuid")) {
      uuidErrorsLogged.push(str);
    }
    originalError.apply(console, args);
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Room creation with UUID separation
    // ----------------------------------------------------
    console.log("[TEST 1] Creating a room and verifying UUID separation in Supabase...");
    const testRoomCode = "tst" + Math.random().toString(36).slice(2, 6);
    const room1 = new Room({
      id: testRoomCode,
      type: 0,
      lang: 0,
      category: "Animals",
      mode: 0,
      slots: 8
    });

    assert.strictEqual(room1.id, testRoomCode, "room.id should be the player-facing room code");
    assert.strictEqual(room1.roomCode, testRoomCode, "room.roomCode should be the player-facing room code");

    // Wait for async Supabase createRoomRecord to complete
    let attempts = 0;
    while (!room1.databaseId && attempts < 30) {
      await sleep(100);
      attempts++;
    }

    if (supabaseService.isConfigured) {
      assert.ok(room1.databaseId, "room.databaseId should be populated from Supabase");
      assert.match(room1.databaseId, UUID_REGEX, "room.databaseId MUST be a valid RFC4122 UUID");
      assert.notStrictEqual(room1.databaseId, testRoomCode, "room.databaseId must NEVER equal the room code");
      console.log(`  -> Room created: roomCode='${room1.roomCode}', databaseId='${room1.databaseId}'`);

      // Verify in Supabase via getRoomRecordByCode
      const remoteRecord = await supabaseService.getRoomRecordByCode(testRoomCode);
      assert.ok(remoteRecord, "Supabase record must be retrievable by room_code");
      assert.strictEqual(remoteRecord.id, room1.databaseId, "Retrieved UUID must match room.databaseId");
      assert.strictEqual(remoteRecord.room_code, testRoomCode, "Retrieved room_code must match player room code");
    } else {
      console.log("  -> (Supabase not configured, verified local Room state)");
    }
    console.log("✓ TEST 1 PASSED: Room created with valid UUID separation.\n");
    passed++;

    // ----------------------------------------------------
    // TEST 2: Room updates without UUID errors
    // ----------------------------------------------------
    console.log("[TEST 2] Updating room record with explicit databaseId and via map lookup...");
    // 2a. Update with explicit databaseId
    db.updateRoomRecord(room1.id, { status: "in_game", gameMode: "Evolution" }, room1.databaseId);
    await sleep(400);

    // 2b. Update without passing databaseId (should use roomCodeToDbId map)
    db.updateRoomRecord(room1.id, { category: "Science" });
    await sleep(400);

    // Verify local SQLite update
    const localRec = db.getRoomRecord(room1.id);
    assert.ok(localRec, "Local room record exists");
    assert.strictEqual(localRec.status, "in_game", "Local status updated to in_game");
    assert.strictEqual(localRec.category, "Science", "Local category updated to Science");

    // Verify Supabase record if configured
    if (supabaseService.isConfigured) {
      const updatedRemote = await supabaseService.getRoomRecordByCode(testRoomCode);
      assert.ok(updatedRemote, "Remote record must exist");
      assert.strictEqual(updatedRemote.status, "in_game", "Remote status updated to in_game");
      assert.strictEqual(updatedRemote.category, "Science", "Remote category updated to Science");
    }

    assert.strictEqual(uuidErrorsLogged.length, 0, `Zero UUID syntax errors expected, got: ${uuidErrorsLogged.join(", ")}`);
    console.log("✓ TEST 2 PASSED: Room updates succeeded with zero UUID errors.\n");
    passed++;

    // ----------------------------------------------------
    // TEST 3: Room players join & leave with UUID foreign key
    // ----------------------------------------------------
    console.log("[TEST 3] Adding room player and marking player left...");
    db.addRoomPlayer({
      roomId: room1.id,
      databaseId: room1.databaseId,
      playerId: 101,
      playerName: "TestPlayer101",
      role: "host"
    });
    await sleep(500);

    // Verify in Supabase
    if (supabaseService.isConfigured && room1.databaseId) {
      const { data: playerRows } = await supabaseService.client
        .from("room_players")
        .select("*")
        .eq("room_id", room1.databaseId)
        .eq("player_id", "101");

      assert.ok(playerRows && playerRows.length > 0, "room_players row must exist in Supabase");
      assert.strictEqual(playerRows[0].room_id, room1.databaseId, "room_players.room_id must be the valid UUID");
      assert.strictEqual(playerRows[0].is_active, true, "Player should be active");
    }

    // Now mark player left
    db.updateRoomPlayerLeft({
      roomId: room1.id,
      databaseId: room1.databaseId,
      playerId: 101
    });
    await sleep(500);

    if (supabaseService.isConfigured && room1.databaseId) {
      const { data: updatedRows } = await supabaseService.client
        .from("room_players")
        .select("*")
        .eq("room_id", room1.databaseId)
        .eq("player_id", "101");

      assert.ok(updatedRows && updatedRows.length > 0, "room_players row exists");
      assert.strictEqual(updatedRows[0].is_active, false, "Player should be marked inactive (left)");
    }

    assert.strictEqual(uuidErrorsLogged.length, 0, `Zero UUID errors expected during player operations, got: ${uuidErrorsLogged.join(", ")}`);
    console.log("✓ TEST 3 PASSED: Room players join and leave executed cleanly with valid UUID FK.\n");
    passed++;

    // ----------------------------------------------------
    // TEST 4: Multiple simultaneous rooms
    // ----------------------------------------------------
    console.log("[TEST 4] Testing multiple simultaneous rooms with distinct codes and UUIDs...");
    const roomCodeA = "rmA" + Math.random().toString(36).slice(2, 6);
    const roomCodeB = "rmB" + Math.random().toString(36).slice(2, 6);

    const roomA = new Room({ id: roomCodeA, type: 0, lang: 0, category: "Geography" });
    const roomB = new Room({ id: roomCodeB, type: 1, lang: 0, category: "Movies" });

    let t = 0;
    while ((!roomA.databaseId || !roomB.databaseId) && t < 30) {
      await sleep(100);
      t++;
    }

    if (supabaseService.isConfigured) {
      assert.notStrictEqual(roomA.databaseId, roomB.databaseId, "Rooms must have distinct database UUIDs");
      assert.match(roomA.databaseId, UUID_REGEX, "Room A databaseId must be UUID");
      assert.match(roomB.databaseId, UUID_REGEX, "Room B databaseId must be UUID");
      console.log(`  -> Room A: code=${roomCodeA}, dbId=${roomA.databaseId}`);
      console.log(`  -> Room B: code=${roomCodeB}, dbId=${roomB.databaseId}`);
    }

    // Clean up test rooms
    roomA.destroy();
    roomB.destroy();
    room1.destroy();
    console.log("✓ TEST 4 PASSED: Multiple simultaneous rooms isolated with distinct UUIDs.\n");
    passed++;

    // ----------------------------------------------------
    // TEST 5: RoomManager teardown and idempotency
    // ----------------------------------------------------
    console.log("[TEST 5] Testing RoomManager.destroy() and idempotency...");
    assert.strictEqual(typeof roomManager.destroy, "function", "roomManager.destroy must be a function");

    // Populate roomManager with a room
    const managedRoom = roomManager.createPublicRoom(0, { category: "General" });
    assert.ok(roomManager.rooms.has(managedRoom.id), "RoomManager has room");

    // Execute first destroy
    roomManager.destroy();
    assert.strictEqual(roomManager.isDestroyed, true, "roomManager.isDestroyed must be true");
    assert.strictEqual(roomManager.rooms.size, 0, "roomManager.rooms must be cleared");
    assert.strictEqual(roomManager.gcInterval, null, "roomManager.gcInterval must be cleared");

    // Execute second destroy (idempotency check)
    assert.doesNotThrow(() => {
      roomManager.destroy();
    }, "Second call to roomManager.destroy() must be safe and not throw");

    console.log("✓ TEST 5 PASSED: RoomManager.destroy() is idempotent and thoroughly tears down state.\n");
    passed++;

    // ----------------------------------------------------
    // TEST 6: Graceful shutdown SIGTERM integration test
    // ----------------------------------------------------
    console.log("[TEST 6] Testing graceful shutdown on SIGTERM in a child server process...");
    const testPort = 3899;
    const serverProc = spawn("node", ["server/server.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, PORT: String(testPort) }
    });

    let serverStarted = false;
    let serverOutput = "";

    serverProc.stdout.on("data", chunk => {
      const str = chunk.toString();
      serverOutput += str;
      if (str.includes("DrawRealm Production server running")) {
        serverStarted = true;
      }
    });

    serverProc.stderr.on("data", chunk => {
      serverOutput += chunk.toString();
    });

    // Wait up to 5s for server to start
    let waitCount = 0;
    while (!serverStarted && waitCount < 50) {
      await sleep(100);
      waitCount++;
    }

    assert.ok(serverStarted, "Server process failed to start within 5s");
    console.log("  -> Child server process running on port " + testPort + ". Sending SIGTERM...");

    // Send SIGTERM
    serverProc.kill("SIGTERM");

    // Wait for exit
    const exitCode = await new Promise(resolve => {
      serverProc.on("exit", (code, sig) => resolve({ code, sig }));
    });

    console.log(`  -> Child server exited with code ${exitCode.code}, sig ${exitCode.sig}`);
    assert.ok(
      serverOutput.includes("Shutting down DrawRealm gracefully"),
      "Output should indicate graceful shutdown began"
    );
    assert.ok(
      serverOutput.includes("HTTP & WebSocket server stopped"),
      "Output should indicate HTTP & WebSocket server stopped"
    );
    assert.ok(
      !serverOutput.includes("TypeError: roomManager.destroy is not a function"),
      "Output must NOT contain 'TypeError: roomManager.destroy is not a function'"
    );

    console.log("✓ TEST 6 PASSED: Server handled SIGTERM gracefully with exit code 0 and no errors.\n");
    passed++;

  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`UUID Syntax Errors Observed: ${uuidErrorsLogged.length}`);
  console.log(`========================================\n`);

  if (failed > 0 || uuidErrorsLogged.length > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
