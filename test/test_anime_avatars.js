const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3001";
const AVATAR_DIR = path.join(__dirname, "../img/avatar");
const CSS_PATH = path.join(__dirname, "../css/style.css");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(fn, timeoutMs = 8000, intervalMs = 50) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        const res = fn();
        if (res) return resolve(res);
      } catch (e) {}
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout waiting for condition after ${timeoutMs}ms`));
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

async function runAvatarTests() {
  console.log("==================================================");
  console.log("   DRAWREALM ANIME AVATAR SYSTEM VERIFICATION     ");
  console.log("==================================================");

  // 1. Verify PNG sprite atlases exist
  console.log("\n[TEST 1] Verifying PNG Sprite Atlases...");
  const requiredFiles = [
    { name: "color_atlas.png", minSize: 100000 },
    { name: "eyes_atlas.png", minSize: 30000 },
    { name: "mouth_atlas.png", minSize: 10000 },
    { name: "special_atlas.png", minSize: 50000 }
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(AVATAR_DIR, file.name);
    assert(fs.existsSync(fullPath), `Sprite atlas ${file.name} must exist in img/avatar/`);
    const stat = fs.statSync(fullPath);
    assert(stat.size >= file.minSize, `${file.name} size is ${stat.size}, expected >= ${file.minSize}`);
    console.log(`  ✓ ${file.name} verified (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  // 2. Verify Old GIF Atlases are not in active img/avatar/ directory
  console.log("\n[TEST 2] Verifying Legacy GIF Retirement...");
  const oldGifs = ["color_atlas.gif", "eyes_atlas.gif", "mouth_atlas.gif", "special_atlas.gif"];
  for (const gif of oldGifs) {
    const fullPath = path.join(AVATAR_DIR, gif);
    assert(!fs.existsSync(fullPath), `Old GIF ${gif} must NOT exist in active img/avatar/`);
  }
  console.log("  ✓ All old GIF atlases retired from active directory");

  // 3. Verify CSS references ONLY the new PNG atlases
  console.log("\n[TEST 3] Verifying CSS Stylesheet References...");
  const css = fs.readFileSync(CSS_PATH, "utf8");
  for (const file of requiredFiles) {
    assert(css.includes(file.name), `style.css must reference ${file.name}`);
  }
  for (const gif of oldGifs) {
    assert(!css.includes(gif), `style.css must NOT reference old GIF ${gif}`);
  }
  const avatarRule = css.match(/\.avatar\{([^}]+)\}/);
  assert(avatarRule && avatarRule[1].includes("image-rendering:auto"), "style.css .avatar must declare image-rendering:auto");
  assert(avatarRule && !avatarRule[1].includes("image-rendering:pixelated"), "style.css .avatar must not declare pixelated rendering");
  console.log("  ✓ style.css verified: 100% PNG references, .avatar uses smooth image-rendering:auto");

  // 4. Test Multiplayer Avatar Synchronization
  console.log("\n[TEST 4] Testing Multiplayer Anime Avatar Synchronization...");
  const avatarA = [2, 5, 10, -1]; // Confident Leader, Cyan eyes, Serious mouth, no acc
  const avatarB = [14, 1, 2, 0];  // Fantasy Mage, Shojo eyes, Smile, Gaming headset

  const clientA = io(SERVER_URL, { transports: ["websocket"], path: "/socket.io/" });
  const clientB = io(SERVER_URL, { transports: ["websocket"], path: "/socket.io/" });

  try {
    await waitFor(() => clientA.connected && clientB.connected);

    let roomInitA = null;
    let roomInitB = null;
    let userJoinedA = null;

    clientA.on("data", (packet) => {
      if (packet.id === 10) roomInitA = packet.data; // ROOM_INIT
      if (packet.id === 1) userJoinedA = packet.data;  // JOIN
    });

    clientB.on("data", (packet) => {
      if (packet.id === 10) roomInitB = packet.data; // ROOM_INIT
    });

    // Player A creates room
    clientA.emit("login", {
      create: 1,
      name: "AnimeLeader",
      lang: "en",
      avatar: avatarA
    });

    await waitFor(() => roomInitA !== null);
    const roomId = roomInitA.id;
    console.log(`  ✓ Room created: ${roomId} with Host Avatar: [${avatarA.join(", ")}]`);

    // Player B joins room
    clientB.emit("login", {
      join: roomId,
      name: "AnimeMage",
      lang: "en",
      avatar: avatarB
    });

    await waitFor(() => roomInitB !== null);
    await waitFor(() => userJoinedA !== null);

    // Verify Player B received Player A's avatar in roomInitB.users
    const hostInB = roomInitB.users.find((u) => u.name === "AnimeLeader");
    assert(hostInB, "Host must be in player list for Player B");
    assert.deepStrictEqual(hostInB.avatar, avatarA, "Player B must receive exact Host anime avatar");
    console.log(`  ✓ Player B sees Player A's anime avatar: [${hostInB.avatar.join(", ")}]`);

    // Verify Player A received Player B's avatar via JOIN packet
    assert.strictEqual(userJoinedA.name, "AnimeMage");
    assert.deepStrictEqual(userJoinedA.avatar, avatarB, "Player A must receive exact joining player anime avatar");
    console.log(`  ✓ Player A sees Player B's anime avatar: [${userJoinedA.avatar.join(", ")}]`);

    // 5. Test Legacy Avatar Modulo Mapping Fallback
    console.log("\n[TEST 5] Testing Legacy / Out-of-Bounds Avatar Normalization...");
    const clientC = io(SERVER_URL, { transports: ["websocket"], path: "/socket.io/" });
    await waitFor(() => clientC.connected);

    let userJoinedByC = null;
    clientA.on("data", (packet) => {
      if (packet.id === 1 && packet.data.name === "LegacyPlayer") {
        userJoinedByC = packet.data;
      }
    });

    // Connect player with legacy or large indices
    clientC.emit("login", {
      join: roomId,
      name: "LegacyPlayer",
      lang: "en",
      avatar: [25, 42, 18, 5]
    });

    await waitFor(() => userJoinedByC !== null);
    assert.deepStrictEqual(userJoinedByC.avatar, [25, 42, 18, 5]);
    console.log(`  ✓ Legacy player avatar accepted and propagated safely: [${userJoinedByC.avatar.join(", ")}]`);

    clientC.disconnect();

  } finally {
    clientA.disconnect();
    clientB.disconnect();
  }

  console.log("\n==================================================");
  console.log("   ALL ANIME AVATAR SYSTEM TESTS PASSED!          ");
  console.log("==================================================");
}

runAvatarTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
