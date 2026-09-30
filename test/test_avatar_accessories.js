
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const io = require("socket.io-client");
const catalog = require("../server/utils/accessoriesCatalog");
const Player = require("../server/players/player");
const db = require("../server/db/database");
const clientAccModule = require("../js/accessories");

async function runTests() {
  console.log("=== DRAWREALM AVATAR ACCESSORIES TEST SUITE ===\n");
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log("  [PASS] [" + total + "] " + name);
      passed++;
    } catch (err) {
      console.error("  [FAIL] [" + total + "] " + name);
      console.error(err);
      process.exitCode = 1;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log("  [PASS] [" + total + "] " + name);
      passed++;
    } catch (err) {
      console.error("  [FAIL] [" + total + "] " + name);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // 1. Asset verification
  test("All 31 SVG accessory files exist in img/accessories/ and are non-empty", () => {
    assert.strictEqual(catalog.ACCESSORIES.length, 31, "Catalog should have 31 accessories");
    const accDir = path.join(__dirname, "../img/accessories");
    assert.ok(fs.existsSync(accDir), "img/accessories directory must exist");

    for (const acc of catalog.ACCESSORIES) {
      const filePath = path.join(accDir, acc.file);
      assert.ok(fs.existsSync(filePath), "File " + acc.file + " must exist");
      const content = fs.readFileSync(filePath, "utf8");
      assert.ok(content.length > 50, "File " + acc.file + " must not be empty");
      assert.ok(content.includes("<svg") && content.includes("</svg>"), "File " + acc.file + " must be valid SVG");
      assert.ok(content.includes("viewBox=\"0 0 160 160\""), "File " + acc.file + " must use 160x160 viewBox");
    }
  });

  // 2. Catalog structure verification
  test("Catalog correctly splits 14 Head, 8 Face, 9 Special accessories", () => {
    const head = catalog.getAccessoriesByCategory("head");
    const face = catalog.getAccessoriesByCategory("face");
    const special = catalog.getAccessoriesByCategory("special");

    assert.strictEqual(head.length, 14, "Expected 14 head accessories");
    assert.strictEqual(face.length, 8, "Expected 8 face accessories");
    assert.strictEqual(special.length, 9, "Expected 9 special accessories");

    const backItems = catalog.ACCESSORIES.filter(a => a.layer === "back");
    assert.strictEqual(backItems.length, 2, "Expected 2 back accessories (small_wings, small_backpack)");
    assert.ok(backItems.some(a => a.id === "small_wings"));
    assert.ok(backItems.some(a => a.id === "small_backpack"));
  });

  // 3. Server avatar validation tests
  test("Player.validateAvatar handles 6-tuples, legacy 4-tuples, and sanitizes input", () => {
    // Valid 6-tuple
    const v1 = Player.validateAvatar([1, 2, 3, -1, "cap", 0]);
    assert.deepStrictEqual(v1, [1, 2, 3, -1, "cap", 0]);

    // Valid back item 6-tuple
    const v2 = Player.validateAvatar([5, 10, 15, 0, "small_wings", 0]);
    assert.deepStrictEqual(v2, [5, 10, 15, 0, "small_wings", 0]);

    // Legacy 4-tuple backward compatibility
    const v3 = Player.validateAvatar([0, 0, 0, -1]);
    assert.deepStrictEqual(v3, [0, 0, 0, -1, "", 0], "Legacy 4-tuple should expand with empty accessory");

    // Invalid/malicious accessory ID
    const v4 = Player.validateAvatar([0, 0, 0, -1, "../../etc/passwd", 0]);
    assert.strictEqual(v4[4], "", "Malicious path traversal must be rejected");

    // Unknown accessory ID
    const v5 = Player.validateAvatar([0, 0, 0, -1, "non_existent_laser_eyes", 0]);
    assert.strictEqual(v5[4], "", "Unknown accessory must be replaced with empty string");

    // Non-array input
    const v6 = Player.validateAvatar("invalid-data");
    assert.strictEqual(v6[4], "", "Non-array must be safely defaulted");
    assert.strictEqual(v6.length, 6);
  });

  // 4. Database persistence tests
  test("Database stores and retrieves avatar accessories without duplicates", () => {
    const testUser = "AccTestUser_" + Math.random().toString(36).slice(2, 7);
    const initialAvatar = [4, 12, 8, -1, "beanie", 0];

    // Save initial player
    db.savePlayer(testUser, { avatar: initialAvatar });
    const p1 = db.getPlayer(testUser);
    assert.ok(p1, "Player should be retrieved from DB");
    assert.strictEqual(p1.avatar_accessory, "beanie", "avatar_accessory column should match");
    assert.strictEqual(p1.avatar[4], "beanie", "avatar array index 4 should match");

    // Update avatar with face accessory
    const updatedAvatar = [4, 12, 8, -1, "cyber_glasses", 0];
    db.updatePlayerAvatar(testUser, updatedAvatar);
    const p2 = db.getPlayer(testUser);
    assert.strictEqual(p2.avatar_accessory, "cyber_glasses", "Updated accessory should be retrieved");
    assert.strictEqual(p2.avatar[4], "cyber_glasses");

    // Update avatar with empty accessory (None)
    const noneAvatar = [4, 12, 8, -1, "", 0];
    db.updatePlayerAvatar(testUser, noneAvatar);
    const p3 = db.getPlayer(testUser);
    assert.strictEqual(p3.avatar_accessory, "", "Empty accessory should be preserved");
    assert.strictEqual(p3.avatar[4], "");
  });

  // 5. Client module and selector logic
  test("Client accessories module controller initializes and navigates categories", () => {
    assert.ok(clientAccModule.DrawRealmAccessories, "DrawRealmAccessories must be defined");
    assert.strictEqual(clientAccModule.ACCESSORIES.length, 31);

    const controller = clientAccModule.DrawRealmAccessories;
    let selectedId = "none";
    controller.onSelectCallback = (id) => { selectedId = id; };

    // Selecting valid accessory
    controller.selectAccessory("wizard_hat");
    assert.strictEqual(controller.currentAccessoryId, "wizard_hat");
    assert.strictEqual(controller.currentCategory, "head");
    assert.strictEqual(selectedId, "wizard_hat");

    // Navigating next in head category
    controller.navigateCategory(1);
    assert.notStrictEqual(controller.currentAccessoryId, "wizard_hat");
    assert.strictEqual(controller.currentCategory, "head");

    // Selecting special category
    controller.setCategory("special");
    assert.strictEqual(controller.currentCategory, "special");
    assert.ok(["cat_ears", "wolf_ears", "demon_horns", "angel_halo", "small_wings", "shoulder_pet", "floating_orb", "small_backpack", "scarf"].includes(controller.currentAccessoryId));

    // Selecting none category
    controller.setCategory("none");
    assert.strictEqual(controller.currentAccessoryId, "");
    assert.strictEqual(selectedId, "");
  });

  // 6. Multiplayer synchronization over Socket.IO
  await testAsync("Multiplayer clients synchronize accessories in room lobby", async () => {
    const URL = "http://localhost:3001";

    function login(loginData) {
      const sock = io(URL, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false
      });
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Login timeout: " + JSON.stringify(loginData))), 6000);
        const doLogin = () => { sock.emit("login", loginData); };
        if (sock.connected) doLogin();
        else sock.once("connect", doLogin);

        sock.on("data", (packet) => {
          if (packet && packet.id === 10) {
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

    const p1Name = "HostAcc_" + Math.random().toString(36).slice(2, 6);
    const p2Name = "GuestAcc_" + Math.random().toString(36).slice(2, 6);
    const p1Avatar = [2, 5, 8, -1, "crown", 0];
    const p2Avatar = [7, 14, 21, -1, "small_wings", 0];

    // Host creates private room
    const hostRes = await login({
      create: 1,
      join: 0,
      name: p1Name,
      lang: "0",
      avatar: p1Avatar
    });

    assert.ok(hostRes.data && hostRes.data.id, "Room ID must exist");
    const roomId = hostRes.data.id;

    // Verify host avatar in room users has crown accessory
    const hostUser = hostRes.data.users.find(u => u.name === p1Name);
    assert.ok(hostUser, "Host must be in users list");
    assert.strictEqual(hostUser.avatar[4], "crown", "Host avatar must have crown accessory");

    // Guest joins room
    const guestRes = await login({
      create: 0,
      join: roomId,
      name: p2Name,
      lang: "0",
      avatar: p2Avatar
    });

    assert.ok(guestRes.data, "Guest must receive room init packet");
    const guestUser = guestRes.data.users.find(u => u.name === p2Name);
    assert.ok(guestUser, "Guest must be in users list");
    assert.strictEqual(guestUser.avatar[4], "small_wings", "Guest avatar must have small_wings accessory");

    // Also verify that guest sees host with crown accessory
    const hostSeenByGuest = guestRes.data.users.find(u => u.name === p1Name);
    assert.ok(hostSeenByGuest, "Host must be present in guest view");
    assert.strictEqual(hostSeenByGuest.avatar[4], "crown", "Guest must see host with crown accessory");

    hostRes.sock.disconnect();
    guestRes.sock.disconnect();
  });

  console.log("\n===========================================");
  console.log("SUMMARY: " + passed + " of " + total + " tests passed (Exit code: " + (process.exitCode || 0) + ")");
  console.log("===========================================\n");
}

runTests().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
