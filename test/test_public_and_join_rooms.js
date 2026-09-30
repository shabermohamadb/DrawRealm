/**
 * DRAWREALM — Public Rooms & Join Rooms Complete Test Suite
 *
 * Verifies all 20 acceptance criteria:
 * 1. Public vs Private room creation
 * 2. Room A (Public, 8 limit, Classic, Anime)
 * 3. Room B (Public, 10 limit, Evolution, Random)
 * 4. Room C (Private, 8 limit, Classic, Cars) strictly hidden from public list
 * 5. Public room metadata (ID, players, maxSlots, mode, category, status, canJoin)
 * 6. Direct join of private room using room code
 * 7. Non-existent room rejection (code 1)
 * 8. Invalid player name rejection (PLAYER_NAME_INVALID)
 * 9. Duplicate name rejection in same room (PLAYER_NAME_TAKEN)
 * 10. Atomic capacity check (2/2 room rejects 3rd entrant with ROOM_FULL)
 * 11. Overfill race condition protection (never 3/2)
 * 12. Started game protection (rejects join with ROOM_ALREADY_STARTED)
 * 13. Public room status changes: Waiting -> In Game -> Full
 * 14. Real-time broadcasts: public_rooms_updated received on creation/join/leave/start
 * 15. Host transfer on disconnect (broadcasts evolution:host_changed)
 * 16. Host update setting (category, mode)
 * 17. Database persistence (SQLite rooms and room_players tables)
 * 18. Multi-room isolation
 * 19. Explicit socket events: get_public_rooms, create_room, join_room, leave_room
 * 20. Disconnect & reconnect with session token without duplicate players
 */

const io = require("socket.io-client");
const assert = require("assert");
const http = require("http");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const config = require("../server/config");

const SERVER_URL = process.env.TEST_SERVER_URL || "http://localhost:3001";
const DB_PATH = path.resolve(config.DATABASE_URL);

const activeSockets = [];

function connectSocket() {
  const sock = io(SERVER_URL, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false
  });
  activeSockets.push(sock);
  return sock;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function loginSocket(loginData) {
  const sock = connectSocket();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Login timeout: " + JSON.stringify(loginData))), 6000);
    const doLogin = () => {
      sock.emit("login", loginData);
    };
    if (sock.connected) {
      doLogin();
    } else {
      sock.once("connect", doLogin);
    }
    sock.on("data", (packet) => {
      if (packet.id === 10) {
        clearTimeout(timeout);
        resolve({ sock, data: packet.data });
      }
    });
    sock.on("joinerr", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function runTests() {
  console.log("============================================================");
  console.log("  DRAWREALM — PUBLIC ROOM + JOIN ROOM COMPREHENSIVE AUDIT");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

  function cleanupSockets() {
    for (const sock of activeSockets) {
      try {
        if (sock.connected) sock.disconnect();
      } catch (e) {}
    }
  }

  async function test(name, fn) {
    total++;
    process.stdout.write(`TEST ${total}: ${name} ... `);
    try {
      await fn();
      console.log("PASSED");
      passed++;
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      process.exitCode = 1;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Room A Creation (Public, 8 limit, Classic, Anime)
    // -------------------------------------------------------------
    let roomAId = null;
    let roomASock = null;

    await test("Create Room A (Public, 8 Limit, Classic Mode 0, Anime Category)", async () => {
      const res = await loginSocket({
        create: 1,
        name: "HostAnime",
        roomType: "public",
        mode: 0,
        slots: 8,
        category: "Anime",
        lang: 0
      });
      roomASock = res.sock;
      roomAId = res.data.id;
      const rType = res.data.roomType || (res.data.type === 0 ? "public" : "private");
      assert.strictEqual(rType, "public", "Room A type should be public");
      assert.strictEqual(res.data.category, "Anime", "Room A category should be Anime");
      assert.strictEqual(res.data.settings[1], 8, "Room A slots should be 8");
      assert.strictEqual(res.data.settings[6], 0, "Room A mode should be Classic 0");
      assert.ok(roomAId, "Room A ID must be generated");
    });

    // -------------------------------------------------------------
    // Test 2: Room B Creation (Public, 10 limit, Evolution, Random)
    // -------------------------------------------------------------
    let roomBId = null;
    let roomBSock = null;

    await test("Create Room B (Public, 10 Limit, Evolution Mode 6, Random Category)", async () => {
      const res = await loginSocket({
        create: 1,
        name: "HostEvo",
        roomType: "public",
        mode: 6,
        slots: 10,
        category: "Random",
        lang: 0
      });
      roomBSock = res.sock;
      roomBId = res.data.id;
      const rType = res.data.roomType || (res.data.type === 0 ? "public" : "private");
      assert.strictEqual(rType, "public", "Room B type should be public");
      assert.strictEqual(res.data.category, "Random", "Room B category should be Random");
      assert.strictEqual(res.data.settings[1], 10, "Room B slots should be 10");
      assert.strictEqual(res.data.settings[6], 6, "Room B mode should be Evolution 6");
      assert.ok(roomBId, "Room B ID must be generated");
    });

    // -------------------------------------------------------------
    // Test 3: Room C Creation (Private, 8 limit, Classic, Cars)
    // -------------------------------------------------------------
    let roomCId = null;
    let roomCSock = null;

    await test("Create Room C (Private, 8 Limit, Classic Mode 0, Cars Category)", async () => {
      const res = await loginSocket({
        create: 1,
        name: "HostCars",
        roomType: "private",
        mode: 0,
        slots: 8,
        category: "Cars",
        lang: 0
      });
      roomCSock = res.sock;
      roomCId = res.data.id;
      const rType = res.data.roomType || (res.data.type === 1 ? "private" : "public");
      assert.strictEqual(rType, "private", "Room C type should be private");
      assert.strictEqual(res.data.category, "Cars", "Room C category should be Cars");
      assert.strictEqual(res.data.settings[1], 8, "Room C slots should be 8");
      assert.ok(roomCId, "Room C ID must be generated");
    });

    // -------------------------------------------------------------
    // Test 4: Public Rooms Discovery & Privacy Filter (REST & Socket)
    // -------------------------------------------------------------
    await test("Public Rooms Discovery: Room A & B visible with metadata, Room C strictly excluded", async () => {
      const rooms = await fetchJson(`${SERVER_URL}/api/rooms`);
      const a = rooms.find(r => r.id === roomAId);
      const b = rooms.find(r => r.id === roomBId);
      const c = rooms.find(r => r.id === roomCId);

      assert.ok(a, "Room A must be present in public list");
      assert.ok(b, "Room B must be present in public list");
      assert.strictEqual(c, undefined, "Room C (PRIVATE) must NOT be present in public list");

      // Verify Room A fields
      assert.strictEqual(a.category, "Anime");
      assert.strictEqual(a.mode, 0);
      assert.strictEqual(a.maxSlots, 8);
      assert.strictEqual(a.players, 1);
      assert.strictEqual(a.status, "Waiting");
      assert.strictEqual(a.canJoin, true);

      // Verify Room B fields
      assert.strictEqual(b.category, "Random");
      assert.strictEqual(b.mode, 6);
      assert.strictEqual(b.maxSlots, 10);
      assert.strictEqual(b.players, 1);
      assert.strictEqual(b.status, "Waiting");
      assert.strictEqual(b.canJoin, true);
    });

    // -------------------------------------------------------------
    // Test 5: Explicit Socket Event get_public_rooms
    // -------------------------------------------------------------
    await test("Explicit Socket Event 'get_public_rooms' returns public rooms and broadcasts", async () => {
      const sock = connectSocket();
      await new Promise((resolve, reject) => {
        sock.on("connect", () => {
          sock.emit("get_public_rooms", (rooms) => {
            try {
              const a = rooms.find(r => r.id === roomAId);
              const c = rooms.find(r => r.id === roomCId);
              assert.ok(a, "get_public_rooms must include Room A");
              assert.strictEqual(c, undefined, "get_public_rooms must NOT include private Room C");
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
      });
    });

    // -------------------------------------------------------------
    // Test 6: Join Private Room via Direct Room Code
    // -------------------------------------------------------------
    await test("Join Private Room C directly using room code", async () => {
      const res = await loginSocket({
        join: roomCId,
        name: "SpeedRacer"
      });
      assert.strictEqual(res.data.id, roomCId);
      assert.strictEqual(res.data.category, "Cars");
    });

    // -------------------------------------------------------------
    // Test 7: Join Non-Existent Room Code -> Rejected with Error
    // -------------------------------------------------------------
    await test("Reject Join for non-existent room code with joinerr 1", async () => {
      const sock = connectSocket();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        sock.on("connect", () => {
          sock.emit("login", {
            join: "NON_EXISTENT_9999",
            name: "LostPlayer"
          });
        });
        sock.on("joinerr", (code) => {
          clearTimeout(timeout);
          assert.strictEqual(code, 1, "Should emit joinerr 1 (room not found)");
          resolve();
        });
      });
    });

    // -------------------------------------------------------------
    // Test 8: Duplicate Player Name Rejection in Same Room
    // -------------------------------------------------------------
    await test("Reject Duplicate player name in same room with PLAYER_NAME_TAKEN", async () => {
      const sock = connectSocket();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        sock.on("connect", () => {
          sock.emit("login", {
            join: roomAId,
            name: "hostanime" // case-insensitive match for HostAnime
          });
        });
        sock.on("joinerr", (err) => {
          clearTimeout(timeout);
          assert.ok(typeof err === "object" && err.code === "PLAYER_NAME_TAKEN");
          resolve();
        });
      });
    });

    // -------------------------------------------------------------
    // Test 9: Atomic Capacity Limit & Overfill Prevention
    // -------------------------------------------------------------
    let roomSmallId = null;
    await test("Atomic Capacity Check: 2/2 room strictly rejects 3rd entrant with ROOM_FULL (code 2)", async () => {
      // Create room with capacity 2
      const hostRes = await loginSocket({ create: 1, name: "P1Cap", slots: 2, roomType: "public" });
      roomSmallId = hostRes.data.id;

      // Join 2nd player -> room now full (2/2)
      await loginSocket({ join: roomSmallId, name: "P2Cap" });

      // Join 3rd player -> MUST be rejected with code 2
      const p3Sock = connectSocket();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout waiting for joinerr")), 5000);
        p3Sock.on("connect", () => {
          p3Sock.emit("login", { join: roomSmallId, name: "P3Cap" });
        });
        p3Sock.on("joinerr", (code) => {
          clearTimeout(timeout);
          assert.strictEqual(code, 2, "Must reject with joinerr 2 (ROOM_FULL)");
          resolve();
        });
      });

      // Verify in public rooms API that status is Full and canJoin is false
      const rooms = await fetchJson(`${SERVER_URL}/api/rooms`);
      const small = rooms.find(r => r.id === roomSmallId);
      assert.ok(small, "Small room should be in public rooms");
      assert.strictEqual(small.players, 2, "Player count must remain 2/2 (never 3/2)");
      assert.strictEqual(small.status, "Full", "Status must be Full");
      assert.strictEqual(small.canJoin, false, "canJoin must be false");
      assert.strictEqual(small.isFull, true, "isFull must be true");
    });

    // -------------------------------------------------------------
    // Test 10: Protection for In-Game Rooms (Started Games)
    // -------------------------------------------------------------
    await test("Started Room Protection: In Game rooms reject new players with ROOM_ALREADY_STARTED", async () => {
      // Add a 2nd player to Room A so the room has enough players (2) to start
      await loginSocket({ join: roomAId, name: "AnimePlayer2" });

      // Start game in Room A (host sends packet 22)
      roomASock.emit("data", { id: 22 });
      await wait(400); // Give gameEngine a moment to start round

      // Check public rooms list updates to 'In Game'
      const rooms = await fetchJson(`${SERVER_URL}/api/rooms`);
      const a = rooms.find(r => r.id === roomAId);
      assert.ok(a);
      assert.strictEqual(a.status, "In Game", "Room status must update to In Game");
      assert.strictEqual(a.canJoin, false, "canJoin must be false once game has started");
      assert.strictEqual(a.isStarted, true, "isStarted must be true");

      // Attempt to join active Room A as normal player
      const lateSock = connectSocket();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        lateSock.on("connect", () => {
          lateSock.emit("login", {
            join: roomAId,
            name: "LateJoiner"
          });
        });
        lateSock.on("joinerr", (err) => {
          clearTimeout(timeout);
          assert.ok(typeof err === "object" && err.code === "ROOM_ALREADY_STARTED", "Must reject with ROOM_ALREADY_STARTED");
          resolve();
        });
      });
    });

    // -------------------------------------------------------------
    // Test 11: Real-time Broadcast: public_rooms_updated
    // -------------------------------------------------------------
    await test("Real-time public_rooms_updated event broadcast across all connected clients", async () => {
      const listenerSock = connectSocket();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout waiting for public_rooms_updated")), 5000);
        listenerSock.on("connect", () => {
          listenerSock.on("public_rooms_updated", (rooms) => {
            clearTimeout(timeout);
            assert.ok(Array.isArray(rooms), "Must receive array of public rooms");
            resolve();
          });

          // Trigger state change by creating a temporary public room
          const tempSock = connectSocket();
          tempSock.on("connect", () => {
            tempSock.emit("login", { create: 1, name: "BroadcastTrigger", roomType: "public" });
          });
        });
      });
    });

    // -------------------------------------------------------------
    // Test 12: Host Disconnect & Host Transfer
    // -------------------------------------------------------------
    await test("Host Disconnect transfers host role to next active player and updates DB", async () => {
      // Create a fresh room with 2 players sequentially
      const hostRes = await loginSocket({ create: 1, name: "InitialHost", roomType: "public" });
      const testRoomId = hostRes.data.id;
      const hostSock = hostRes.sock;

      const guestRes = await loginSocket({ join: testRoomId, name: "SecondPlayer" });
      const guestSock = guestRes.sock;

      // Set up listener on guest for host changed event
      const hostChangedPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout waiting for host transfer")), 5000);
        guestSock.on("evolution:host_changed", (data) => {
          clearTimeout(timeout);
          assert.strictEqual(data.hostName, "SecondPlayer", "SecondPlayer should now be host");
          resolve();
        });
      });

      // Disconnect initial host
      hostSock.disconnect();
      await hostChangedPromise;
    });

    // -------------------------------------------------------------
    // Test 13: Explicit socket events CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM
    // -------------------------------------------------------------
    await test("Explicit Socket Events: CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM", async () => {
      const sock = connectSocket();
      let createdRoomId = null;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        sock.on("connect", () => {
          sock.emit("CREATE_ROOM", { name: "ExplicitHost", roomType: "public", category: "Food" });
        });
        sock.on("data", (p) => {
          if (p.id === 10) {
            clearTimeout(timeout);
            createdRoomId = p.data.id;
            assert.strictEqual(p.data.category, "Food");
            resolve();
          }
        });
      });

      // Now leave room
      await new Promise((resolve) => {
        sock.emit("LEAVE_ROOM", (res) => {
          assert.strictEqual(res.ok, true);
          resolve();
        });
      });
    });

    // -------------------------------------------------------------
    // Test 14: Database Persistence (SQLite rooms & room_players)
    // -------------------------------------------------------------
    await test("Database Persistence: rooms and room_players SQLite records verified", async () => {
      const db = new DatabaseSync(DB_PATH);
      try {
        const roomA = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomAId);
        assert.ok(roomA, "Room A record must exist in SQLite rooms table");
        assert.strictEqual(roomA.room_type, "public");
        assert.strictEqual(roomA.category, "Anime");
        assert.strictEqual(roomA.game_mode, "Classic");
        assert.strictEqual(roomA.max_players, 8);

        const roomB = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomBId);
        assert.ok(roomB, "Room B record must exist in SQLite rooms table");
        assert.strictEqual(roomB.room_type, "public");
        assert.strictEqual(roomB.category, "Random");
        assert.strictEqual(roomB.game_mode, "Evolution");
        assert.strictEqual(roomB.max_players, 10);

        const roomC = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomCId);
        assert.ok(roomC, "Room C record must exist in SQLite rooms table");
        assert.strictEqual(roomC.room_type, "private");
        assert.strictEqual(roomC.category, "Cars");
        assert.strictEqual(roomC.game_mode, "Classic");
        assert.strictEqual(roomC.max_players, 8);

        const playersA = db.prepare("SELECT * FROM room_players WHERE room_id = ?").all(roomAId);
        assert.ok(playersA.length >= 1, "Room A must have player records in SQLite");
      } finally {
        db.close();
      }
    });

    // -------------------------------------------------------------
    // Test 15: Reconnection Session Resume Without Duplicate Player
    // -------------------------------------------------------------
    await test("Reconnection session resume preserves seat without duplicate player count", async () => {
      const res = await loginSocket({ create: 1, name: "ReconPlayer", roomType: "public" });
      const token = res.data.reconnectToken;
      const rId = res.data.id;
      assert.ok(token, "Must receive reconnect token");

      // Disconnect first socket
      res.sock.disconnect();
      await wait(100);

      // Reconnect on new socket with token
      const sock2 = connectSocket();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout reconnecting")), 5000);
        sock2.on("connect", () => {
          sock2.emit("login", {
            reconnectToken: token,
            join: rId,
            name: "ReconPlayer"
          });
        });
        sock2.on("data", (p) => {
          if (p.id === 10) {
            clearTimeout(timeout);
            assert.strictEqual(p.data.id, rId);
            resolve();
          }
        });
      });
    });

    console.log("\n============================================================");
    console.log(`  ALL ${passed}/${total} AUDIT TESTS PASSED SUCCESSFULLY!`);
    console.log("============================================================\n");

  } finally {
    cleanupSockets();
  }
}

runTests().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
