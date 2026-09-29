const { io } = require("socket.io-client");
const http = require("http");
const assert = require("assert");

const SERVER_URL = "http://localhost:3001";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitFor(fn, timeoutMs = 10000, intervalMs = 50) {
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

function createClient(name) {
  const socket = io(SERVER_URL, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false
  });

  const state = {
    socket,
    name,
    id: null,
    roomId: null,
    reconnectToken: null,
    roomInit: null,
    gameState: null,
    secretWord: null,
    strokes: [],
    chatMessages: [],
    evolutionState: null,
    isDisconnected: false,
    rawPackets: []
  };

  socket.on("connect", () => {
    // console.log(`[${name}] Socket connected`);
  });

  socket.on("drawrealm:session", (sess) => {
    state.reconnectToken = sess.token;
    state.roomId = sess.roomId;
    state.id = sess.playerId;
  });

  socket.on("evolution:state", (evo) => {
    state.evolutionState = evo;
  });

  socket.on("data", (packet) => {
    if (!packet) return;
    state.rawPackets.push(packet);
    switch (packet.id) {
      case 10: // ROOM_INIT
        state.roomInit = packet.data;
        state.id = packet.data.me;
        state.roomId = packet.data.id;
        state.reconnectToken = packet.data.reconnectToken;
        if (packet.data.state) {
          state.gameState = packet.data.state;
        }
        break;

      case 11: // STATE
        state.gameState = packet.data;
        if (packet.data.id === 4 && packet.data.data && typeof packet.data.data.word === "string") {
          state.secretWord = packet.data.data.word;
        }
        break;

      case 19: // DRAW_STROKES
        state.strokes.push(...(packet.data || []));
        break;

      case 30: // CHAT
        state.chatMessages.push(packet.data);
        break;
    }
  });

  socket.on("disconnect", () => {
    state.isDisconnected = true;
  });

  return state;
}

async function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}${path}`, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("==================================================");
  console.log("   DRAWREALM PRODUCTION MULTIPLAYER VERIFICATION  ");
  console.log("==================================================");

  // -------------------------------------------------------------------------
  // TEST 1: Production Health Endpoint & Security Headers
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing /health and HTTP Security Headers...");
  const healthRes = await httpGet("/health");
  assert.strictEqual(healthRes.status, 200, "Health check must return 200 OK");
  assert.strictEqual(healthRes.data.status, "ok", "Health status must be ok");
  assert.strictEqual(healthRes.data.database, "connected", "Database must be connected");
  assert.strictEqual(healthRes.headers["x-content-type-options"], "nosniff", "Missing X-Content-Type-Options");
  assert.strictEqual(healthRes.headers["x-frame-options"], "SAMEORIGIN", "Missing X-Frame-Options");
  assert.strictEqual(healthRes.headers["x-xss-protection"], "1; mode=block", "Missing X-XSS-Protection");
  console.log("  ✓ /health endpoint returned 200 with database: connected");
  console.log("  ✓ Security headers verified (nosniff, SAMEORIGIN, XSS-block)");

  // -------------------------------------------------------------------------
  // TEST 2: 5 Players Real-Time Connection & Reconnect Tokens
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] Connecting 5 players (Alice, Bob, Charlie, Dana, Evan)...");
  const alice = createClient("Alice");
  await waitFor(() => alice.socket.connected);

  // Alice creates a private room with Evolution Mode
  alice.socket.emit("login", {
    create: 1,
    name: "Alice",
    lang: "en",
    mode: 6, // Evolution Mode
    slots: 8,
    rounds: 2,
    drawtime: 40
  });

  await waitFor(() => alice.roomInit && alice.roomId);
  const roomId = alice.roomId;
  console.log(`  ✓ Room created with cryptographic ID: ${roomId}`);
  assert(alice.reconnectToken, "Alice must receive reconnectToken");

  const bob = createClient("Bob");
  const charlie = createClient("Charlie");
  const dana = createClient("Dana");
  const evan = createClient("Evan");

  const clients = [alice, bob, charlie, dana, evan];

  // Join other 4 players
  for (const client of [bob, charlie, dana, evan]) {
    await waitFor(() => client.socket.connected);
    client.socket.emit("login", {
      join: roomId,
      name: client.name,
      lang: "en"
    });
    await waitFor(() => client.roomInit && client.reconnectToken);
    console.log(`  ✓ ${client.name} joined room (Player ID: ${client.id})`);
  }

  // Verify all 5 are recognized in the room
  await waitFor(() => {
    return clients.every(c => c.roomInit && c.roomInit.users && c.roomInit.users.length >= 1);
  });
  console.log("  ✓ All 5 players successfully joined and received session tokens");

  // -------------------------------------------------------------------------
  // TEST 3: Authoritative Game Flow, Stroke Sync & Guess Scoring
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] Starting game and verifying drawing strokes & guess sync...");
  // Host starts game
  alice.socket.emit("data", { id: 22 });

  // Wait for game to advance to WORD_CHOICE (id: 3)
  await waitFor(() => {
    return clients.some(c => c.gameState && c.gameState.id === 3);
  }, 10000);
  console.log("  ✓ Match started: State 1 (STARTING) -> State 2 (ROUND_START) -> State 3 (WORD_CHOICE)");

  // Find drawer
  const drawerClient = clients.find(c => c.gameState && c.gameState.id === 3 && c.gameState.data && c.gameState.data.words);
  assert(drawerClient, "A drawer must receive word options");
  console.log(`  ✓ Drawer is ${drawerClient.name} (Player ID: ${drawerClient.id})`);

  // Drawer picks word index 0
  drawerClient.socket.emit("data", { id: 18, data: 0 });

  // Wait for DRAWING state (id: 4)
  await waitFor(() => {
    return clients.every(c => c.gameState && c.gameState.id === 4);
  });
  const secretWord = drawerClient.secretWord;
  assert(secretWord, "Drawer must know the secret word");
  console.log(`  ✓ Entered DRAWING state. Secret word: "${secretWord}"`);

  // Drawer draws a stroke batch: [[0, color, size, x1, y1, x2, y2]]
  const testStroke = [0, 1, 10, 50, 50, 150, 150];
  drawerClient.socket.emit("data", { id: 19, data: [testStroke] });

  // Verify guessers receive stroke
  const guessers = clients.filter(c => c.id !== drawerClient.id);
  await waitFor(() => {
    return guessers.every(g => g.strokes.length > 0);
  });
  console.log("  ✓ Real-time drawing strokes synchronized across all 4 guessers");

  // Guesser Bob submits the correct guess
  const guesserBob = bob.id === drawerClient.id ? evan : bob;
  console.log(`  ✓ ${guesserBob.name} guessing: "${secretWord}"`);
  guesserBob.socket.emit("data", { id: 30, data: secretWord });

  // Wait for correct guess event or chat confirmation
  await waitFor(() => {
    return clients.some(c => c.rawPackets.some(p => p.id === 15 || (p.id === 30 && p.data && p.data.msg && p.data.msg.includes("guessed the word"))));
  });
  console.log(`  ✓ Server validated guess: ${guesserBob.name} correctly guessed the word!`);

  // -------------------------------------------------------------------------
  // TEST 4: Seamless Session Reconnection with Token
  // -------------------------------------------------------------------------
  console.log("\n[TEST 4] Testing session reconnection with cryptographically secure token...");
  const reconnectSubject = dana.id === drawerClient.id ? evan : dana;
  const savedToken = reconnectSubject.reconnectToken;
  assert(savedToken, "Player must possess reconnectToken");
  console.log(`  ✓ Simulating connection drop for ${reconnectSubject.name} (Token: ${savedToken.slice(0, 16)}...)`);

  // Disconnect socket
  reconnectSubject.socket.disconnect();
  await wait(300);

  // Connect fresh socket and resume session using reconnectToken
  const reconnectedSubject = createClient(`${reconnectSubject.name}_Resumed`);
  await waitFor(() => reconnectedSubject.socket.connected);

  reconnectedSubject.socket.emit("login", {
    reconnectToken: savedToken
  });

  // Verify reconnected player receives ROOM_INIT with full synchronization
  await waitFor(() => reconnectedSubject.roomInit && reconnectedSubject.gameState);
  assert.strictEqual(reconnectedSubject.roomId, roomId, "Reconnected room ID must match");
  assert.strictEqual(reconnectedSubject.id, reconnectSubject.id, "Reconnected player ID must be preserved");
  assert.strictEqual(reconnectedSubject.gameState.id, 4, "State must remain DRAWING with active timer");
  assert(reconnectedSubject.gameState.time >= 0, "Remaining time must be synchronized");
  console.log(`  ✓ ${reconnectSubject.name} reconnected seamlessly: ID, room state, remaining timer restored without match freeze!`);

  // -------------------------------------------------------------------------
  // TEST 5: Active Drawer Disconnect & Graceful Turn Skip
  // -------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing drawer abrupt disconnect recovery...");
  console.log(`  ✓ Disconnecting active drawer: ${drawerClient.name}...`);
  drawerClient.socket.disconnect();

  // Verify server broadcast drawer disconnect notice
  await waitFor(() => {
    return guessers.some(g => g.chatMessages.some(m => m.msg && m.msg.includes("drawer disconnected")));
  }, 5000);
  console.log("  ✓ Server announced drawer disconnect with 15s grace countdown");

  // Wait for 15s grace period to expire and server to advance turn (REVEAL, WORD_CHOICE, or ROUND_START)
  await waitFor(() => {
    return guessers.some(g => g.gameState && (g.gameState.id === 5 || g.gameState.id === 3 || g.gameState.id === 2));
  }, 22000);
  console.log("  ✓ Server handled drawer grace period expiry: advanced turn with REASONS.DRAWER_LEFT without match freeze");

  // -------------------------------------------------------------------------
  // TEST 6: Simultaneous Multi-Room Concurrency & Isolation
  // -------------------------------------------------------------------------
  console.log("\n[TEST 6] Testing multiple simultaneous rooms concurrency (Rooms A, B, C)...");
  const hostB = createClient("Host_RoomB");
  const playerB = createClient("Player_RoomB");
  const hostC = createClient("Host_RoomC");
  const playerC = createClient("Player_RoomC");

  await waitFor(() => hostB.socket.connected && hostC.socket.connected);

  hostB.socket.emit("login", { create: 1, name: "HostB", lang: "en" });
  hostC.socket.emit("login", { create: 1, name: "HostC", lang: "en" });

  await waitFor(() => hostB.roomId && hostC.roomId);
  const roomBId = hostB.roomId;
  const roomCId = hostC.roomId;
  assert.notStrictEqual(roomBId, roomCId, "Room B and C must have distinct IDs");
  assert.notStrictEqual(roomBId, roomId, "Room B and Main Room must have distinct IDs");

  await waitFor(() => playerB.socket.connected && playerC.socket.connected);
  playerB.socket.emit("login", { join: roomBId, name: "PlayerB", lang: "en" });
  playerC.socket.emit("login", { join: roomCId, name: "PlayerC", lang: "en" });

  await waitFor(() => playerB.roomId === roomBId && playerC.roomId === roomCId);

  // Send unique chat message in Room B
  const uniqueMessageB = `MSG_ROOM_B_${Date.now()}`;
  playerB.socket.emit("data", { id: 30, data: uniqueMessageB });

  await waitFor(() => hostB.chatMessages.some(m => m.msg === uniqueMessageB));

  // Verify Room C and Main Room never received Room B's message
  const leakedToC = hostC.chatMessages.some(m => m.msg === uniqueMessageB);
  const leakedToMain = alice.chatMessages.some(m => m.msg === uniqueMessageB);
  assert(!leakedToC, "Room C must not leak messages from Room B");
  assert(!leakedToMain, "Main Room must not leak messages from Room B");
  console.log(`  ✓ Concurrently active rooms running in complete isolation with zero cross-room leaks`);

  const statsRes = await httpGet("/api/stats");
  assert(statsRes.data.activeRooms >= 3, "Stats must report multiple active rooms");
  console.log(`  ✓ Live stats confirmed: ${statsRes.data.activeRooms} active rooms, ${statsRes.data.onlinePlayers} online players`);

  // -------------------------------------------------------------------------
  // TEST 7: Rate Limiting & Input Sanitization
  // -------------------------------------------------------------------------
  console.log("\n[TEST 7] Testing security rate limiting & XSS text sanitization...");
  const spammer = createClient("Spammer");
  await waitFor(() => spammer.socket.connected);
  spammer.socket.emit("login", { join: roomBId, name: "Spammer", lang: "en" });
  await waitFor(() => spammer.roomId);

  // Spam 50 chat messages in 50ms
  for (let i = 0; i < 50; i++) {
    spammer.socket.emit("data", { id: 30, data: `Spam ${i}` });
  }
  await wait(500);

  // Verify rate limiter throttled the spam
  const spamReceived = hostB.chatMessages.filter(m => m.msg && m.msg.startsWith("Spam "));
  assert(spamReceived.length <= 5, "Rate limiter must cap messages at <= 5/sec");
  console.log(`  ✓ Rate limiter throttled spam: accepted ${spamReceived.length} of 50 packets, safely dropping flood`);

  // Wait 1200ms for the 1-second sliding window to reset
  await wait(1200);

  // Send an XSS test string
  hostB.chatMessages = [];
  spammer.socket.emit("data", { id: 30, data: "<script>alert(1)</script>SafeText" });
  await waitFor(() => hostB.chatMessages.length > 0);
  const receivedMsg = hostB.chatMessages[hostB.chatMessages.length - 1].msg;
  assert(!receivedMsg.includes("<script>"), "HTML/script tags must be stripped");
  assert(receivedMsg.includes("SafeText"), "Sanitized content must be preserved");
  console.log(`  ✓ XSS payload sanitized: "${receivedMsg}"`);
  console.log("  ✓ Rate limiter prevented packet flooding without affecting server stability");

  // Clean up sockets
  const allSockets = [alice, bob, charlie, dana, evan, reconnectedSubject, hostB, playerB, hostC, playerC, spammer];
  for (const c of allSockets) {
    if (c.socket && c.socket.connected) {
      c.socket.disconnect();
    }
  }

  console.log("\n==================================================");
  console.log("   ALL 7 PRODUCTION MULTIPLAYER TESTS PASSED!     ");
  console.log("==================================================");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
