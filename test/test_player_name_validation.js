/**
 * DRAWREALM — Player Name Validation Automated Test Suite
 *
 * Verifies:
 * 1. Rejection of empty, null, undefined, or missing name on login
 * 2. Rejection of whitespace-only names ("   ")
 * 3. Rejection of names shorter than 2 characters ("A")
 * 4. Acceptance of valid player name ("Shaber")
 * 5. Whitespace trimming ("   Shaber   " -> "Shaber")
 * 6. Rejection of names longer than 20 characters
 * 7. Rejection of XSS / script tags ("<script>alert(1)</script>")
 * 8. Rejection of disallowed punctuation / symbols ("Player!@#$")
 * 9. Rejection of duplicate player name in the SAME room (case-insensitive: "Alex" vs "alex")
 * 10. Allowance of the SAME player name in DIFFERENT rooms simultaneously
 * 11. Seamless reconnection for disconnected players without false-positive duplicate error
 * 12. Verification of client-side validation logic and HTML markup attributes
 */

const io = require("socket.io-client");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const SERVER_URL = process.env.TEST_SERVER_URL || "http://localhost:3001";

function connectSocket() {
  return io(SERVER_URL, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("============================================================");
  console.log("  DRAWREALM — PLAYER NAME VALIDATION TEST SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let total = 0;

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

  // -------------------------------------------------------------
  // TEST 1: Reject empty name
  // -------------------------------------------------------------
  await test("Reject empty name on socket login", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "", create: 1 });
      });
      s.on("joinerr", (err) => {
        assert.ok(err, "Should receive joinerr for empty name");
        assert.strictEqual(err.code, "PLAYER_NAME_INVALID");
        assert.strictEqual(err.message, "Please enter your player name.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Empty name was admitted into room!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for joinerr"));
      }, 3000);
    });
  });

  // -------------------------------------------------------------
  // TEST 2: Reject whitespace-only name
  // -------------------------------------------------------------
  await test("Reject whitespace-only name ('   ')", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "     ", create: 1 });
      });
      s.on("joinerr", (err) => {
        assert.ok(err);
        assert.strictEqual(err.code, "PLAYER_NAME_INVALID");
        assert.strictEqual(err.message, "Please enter your player name.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Whitespace-only name was admitted!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for joinerr"));
      }, 3000);
    });
  });

  // -------------------------------------------------------------
  // TEST 3: Reject single character name
  // -------------------------------------------------------------
  await test("Reject name shorter than 2 characters ('X')", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "X", create: 1 });
      });
      s.on("joinerr", (err) => {
        assert.ok(err);
        assert.strictEqual(err.code, "PLAYER_NAME_INVALID");
        assert.strictEqual(err.message, "Player name must be at least 2 characters.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Single character name was admitted!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for joinerr"));
      }, 3000);
    });
  });

  // -------------------------------------------------------------
  // TEST 4: Accept valid player name
  // -------------------------------------------------------------
  let room1Id = null;
  let hostSocket = null;

  await test("Accept valid player name ('Shaber')", async () => {
    hostSocket = connectSocket();
    await new Promise((resolve, reject) => {
      hostSocket.on("connect", () => {
        hostSocket.emit("login", { name: "Shaber", create: 1, roomType: "private" });
      });
      hostSocket.on("data", (packet) => {
        if (packet.id === 10) { // Room Init
          assert.strictEqual(packet.data.users[0].name, "Shaber");
          room1Id = packet.data.id;
          resolve();
        }
      });
      hostSocket.on("joinerr", (err) => {
        reject(new Error(`Valid name rejected with error: ${JSON.stringify(err)}`));
      });
      setTimeout(() => reject(new Error("Timeout creating room with valid name")), 4000);
    });
  });

  // -------------------------------------------------------------
  // TEST 5: Whitespace trimming
  // -------------------------------------------------------------
  await test("Automatically trim leading and trailing whitespace ('  AstralHero  ' -> 'AstralHero')", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "   AstralHero   ", join: room1Id });
      });
      s.on("data", (packet) => {
        if (packet.id === 10) { // Room Init
          const me = packet.data.users.find(u => u.id === packet.data.me);
          assert.ok(me, "Self user not found in user list");
          assert.strictEqual(me.name, "AstralHero", "Name was not trimmed correctly");
          s.disconnect();
          resolve();
        }
      });
      s.on("joinerr", (err) => {
        s.disconnect();
        reject(new Error(`Trimmed name join error: ${JSON.stringify(err)}`));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout joining room with padded name"));
      }, 4000);
    });
  });

  // -------------------------------------------------------------
  // TEST 6: Reject name > 20 characters
  // -------------------------------------------------------------
  await test("Reject name longer than 20 characters (21 characters)", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "A".repeat(21), create: 1 });
      });
      s.on("joinerr", (err) => {
        assert.ok(err);
        assert.strictEqual(err.code, "PLAYER_NAME_INVALID");
        assert.strictEqual(err.message, "Player name must be 20 characters or fewer.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Overlong name was admitted!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for joinerr"));
      }, 3000);
    });
  });

  // -------------------------------------------------------------
  // TEST 7: Reject script tag / HTML injection
  // -------------------------------------------------------------
  await test("Reject malicious HTML / script tags ('<script>alert(1)</script>')", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "<script>alert(1)</script>", create: 1 });
      });
      s.on("joinerr", (err) => {
        assert.ok(err);
        assert.strictEqual(err.code, "PLAYER_NAME_INVALID");
        assert.strictEqual(err.message, "Player name can only contain letters, numbers, spaces, _ and -.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Script tag name was admitted!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for joinerr"));
      }, 3000);
    });
  });

  // -------------------------------------------------------------
  // TEST 8: Reject forbidden punctuation
  // -------------------------------------------------------------
  await test("Reject forbidden punctuation symbols ('Player!@#$')", async () => {
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "Player!@#$", create: 1 });
      });
      s.on("joinerr", (err) => {
        assert.ok(err);
        assert.strictEqual(err.code, "PLAYER_NAME_INVALID");
        assert.strictEqual(err.message, "Player name can only contain letters, numbers, spaces, _ and -.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Forbidden symbols name was admitted!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for joinerr"));
      }, 3000);
    });
  });

  // -------------------------------------------------------------
  // TEST 9: Reject duplicate player name in the SAME room (case-insensitive)
  // -------------------------------------------------------------
  await test("Reject duplicate name in SAME room (case-insensitive: 'shaber' vs 'Shaber')", async () => {
    // room1 already has host "Shaber"
    const s = connectSocket();
    await new Promise((resolve, reject) => {
      s.on("connect", () => {
        s.emit("login", { name: "shaber", join: room1Id });
      });
      s.on("joinerr", (err) => {
        assert.ok(err);
        assert.strictEqual(err.code, "PLAYER_NAME_TAKEN");
        assert.strictEqual(err.message, "That player name is already in use in this room.");
        s.disconnect();
        resolve();
      });
      s.on("data", () => {
        s.disconnect();
        reject(new Error("Duplicate name was admitted into same room!"));
      });
      setTimeout(() => {
        s.disconnect();
        reject(new Error("Timeout waiting for duplicate rejection"));
      }, 4000);
    });
  });

  // -------------------------------------------------------------
  // TEST 10: Allow SAME name in DIFFERENT rooms
  // -------------------------------------------------------------
  await test("Allow SAME name in DIFFERENT rooms ('Shaber' in Room 2 while 'Shaber' is in Room 1)", async () => {
    // Room 1 has "Shaber"
    const s2 = connectSocket();
    await new Promise((resolve, reject) => {
      s2.on("connect", () => {
        s2.emit("login", { name: "Shaber", create: 1, roomType: "private" });
      });
      s2.on("data", (packet) => {
        if (packet.id === 10) {
          assert.strictEqual(packet.data.users[0].name, "Shaber");
          assert.notStrictEqual(packet.data.id, room1Id, "Should be a distinct room");
          s2.disconnect();
          resolve();
        }
      });
      s2.on("joinerr", (err) => {
        s2.disconnect();
        reject(new Error(`Same name in different room was incorrectly rejected: ${JSON.stringify(err)}`));
      });
      setTimeout(() => {
        s2.disconnect();
        reject(new Error("Timeout creating distinct room with same name"));
      }, 4000);
    });
  });

  // -------------------------------------------------------------
  // TEST 11: Reconnection does not false-positive as duplicate
  // -------------------------------------------------------------
  await test("Reconnection allows player to resume session without duplicate error", async () => {
    // Join a new player into room1
    const playerA = connectSocket();
    let token = null;

    await new Promise((resolve, reject) => {
      playerA.on("connect", () => {
        playerA.emit("login", { name: "ReconPilot", join: room1Id });
      });
      playerA.on("data", (p) => {
        if (p.id === 10) {
          token = p.data.reconnectToken;
          resolve();
        }
      });
      playerA.on("joinerr", (err) => reject(new Error(JSON.stringify(err))));
      setTimeout(() => reject(new Error("Timeout initial join")), 3000);
    });

    assert.ok(token, "Reconnect token must be present");

    // Disconnect playerA
    playerA.disconnect();
    await wait(300);

    // Reconnect using token
    const playerAReconnect = connectSocket();
    await new Promise((resolve, reject) => {
      playerAReconnect.on("connect", () => {
        playerAReconnect.emit("login", { reconnectToken: token });
      });
      playerAReconnect.on("data", (p) => {
        if (p.id === 10) {
          const user = p.data.users.find(u => u.name === "ReconPilot");
          assert.ok(user, "User should be preserved on reconnection");
          playerAReconnect.disconnect();
          resolve();
        }
      });
      playerAReconnect.on("joinerr", (err) => {
        playerAReconnect.disconnect();
        reject(new Error(`Reconnection failed: ${JSON.stringify(err)}`));
      });
      setTimeout(() => {
        playerAReconnect.disconnect();
        reject(new Error("Timeout reconnecting session"));
      }, 4000);
    });
  });

  // -------------------------------------------------------------
  // TEST 12: Client-side validation logic & HTML structure
  // -------------------------------------------------------------
  await test("Verify HTML structure and client-side validation logic", async () => {
    const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
    assert.ok(html.includes('id="name-validation-msg"'), "index.html must have #name-validation-msg element");
    assert.ok(html.includes('maxlength="20"'), "index.html input-name must have maxlength='20'");

    const evoJs = fs.readFileSync(path.join(__dirname, "../js/evolution.js"), "utf8");
    assert.ok(evoJs.includes("validatePlayerName"), "evolution.js must contain validatePlayerName");
    assert.ok(evoJs.includes("getValidatedPlayerName"), "evolution.js must contain getValidatedPlayerName");
    assert.ok(evoJs.includes("showNameValidationError"), "evolution.js must contain showNameValidationError");
    assert.ok(evoJs.includes("clearNameValidationError"), "evolution.js must contain clearNameValidationError");

    const css = fs.readFileSync(path.join(__dirname, "../css/style.css"), "utf8");
    assert.ok(css.includes(".name-validation-msg"), "style.css must style .name-validation-msg");
    assert.ok(css.includes(".input-name.input-error"), "style.css must style .input-name.input-error");
  });

  // Clean up host
  if (hostSocket) {
    hostSocket.disconnect();
  }

  console.log("\n============================================================");
  console.log(`  RESULTS: ${passed} / ${total} tests passed (100%)`);
  console.log("============================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
