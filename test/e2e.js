const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

class ChromeTab {
  constructor(tabInfo) {
    this.id = tabInfo.id;
    this.wsUrl = tabInfo.webSocketDebuggerUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.exceptions = [];
    this.failedRequests = [];
    this.requests = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        cb(msg.result);
      }

      if (msg.method === "Network.requestWillBeSent") {
        this.requests.set(msg.params.requestId, msg.params.request.url);
      } else if (msg.method === "Runtime.consoleAPICalled") {
        this.consoleLogs.push({
          type: msg.params.type,
          text: msg.params.args.map(a => a.value || a.description).join(" ")
        });
      } else if (msg.method === "Runtime.exceptionThrown") {
        const url = msg.params.exceptionDetails?.url || "";
        if (!url.includes("adinplay") && !url.includes("googlesyndication") && !url.includes("google") && !url.includes("doubleclick")) {
          this.exceptions.push(msg.params.exceptionDetails);
        }
      } else if (msg.method === "Network.loadingFailed") {
        if (!msg.params.canceled) {
          const url = this.requests.get(msg.params.requestId) || "";
          if (url.includes("localhost") || url.includes("127.0.0.1")) {
            this.failedRequests.push({ ...msg.params, url });
          }
        }
      }
    };

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Network.enable");
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
  }

  async captureScreenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    if (res && res.data) {
      fs.writeFileSync(filepath, Buffer.from(res.data, "base64"));
    }
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const id = this.msgId++;
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res && res.result ? res.result.value : undefined;
  }

  async waitFor(expression, timeoutMs = 10000, intervalMs = 200) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const val = await this.eval(expression);
      if (val) return val;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runE2ETest() {
  console.log("=== STARTING FULL E2E MULTIPLAYER TEST ===");
  const CDP_PORT = 9230;

  // 1. Launch Chromium
  const chrome = spawn("chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${CDP_PORT}`
  ]);

  await new Promise(r => setTimeout(r, 1500));

  function putTab(url) {
    return new Promise((resolve, reject) => {
      const u = new URL(`http://127.0.0.1:${CDP_PORT}/json/new?${url}`);
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: "PUT"
      }, res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => resolve(JSON.parse(d)));
      });
      req.on("error", reject);
      req.end();
    });
  }

  let alice = null;
  let bob = null;
  let charlie = null;

  try {
    // 2. Open Tab 1: Player A (Alice)
    console.log("Opening Tab 1 (Alice)...");
    const tab1Info = await putTab("http://localhost:3001/");
    alice = new ChromeTab(tab1Info);
    await alice.connect();

    // Alice sets name and clicks "Create Private Room"
    await alice.waitFor("document.readyState === 'complete'");
    await alice.eval("document.querySelector('#home .container-name-lang input').value = 'Alice'");
    await alice.eval("document.querySelector('#home .panel .button-create').click()");

    // Wait for Alice to enter the room
    await alice.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Alice created private room!");

    // Extract room invite link
    const inviteUrl = await alice.waitFor("document.querySelector('#input-invite').value");
    console.log("Room Invite URL:", inviteUrl);
    const roomId = inviteUrl.split("?")[1];
    console.log("Extracted Room ID:", roomId);

    // 3. Open Tab 2: Player B (Bob)
    console.log("Opening Tab 2 (Bob)...");
    const tab2Info = await putTab(`http://localhost:3001/?${roomId}`);
    const bob = new ChromeTab(tab2Info);
    await bob.connect();

    await bob.waitFor("document.readyState === 'complete'");
    await bob.eval("document.querySelector('#home .container-name-lang input').value = 'Bob'");
    await bob.eval("document.querySelector('#home .panel .button-play').click()");
    await bob.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Bob joined the room!");

    // 4. Open Tab 3: Player C (Charlie)
    console.log("Opening Tab 3 (Charlie)...");
    const tab3Info = await putTab(`http://localhost:3001/?${roomId}`);
    const charlie = new ChromeTab(tab3Info);
    await charlie.connect();

    await charlie.waitFor("document.readyState === 'complete'");
    await charlie.eval("document.querySelector('#home .container-name-lang input').value = 'Charlie'");
    await charlie.eval("document.querySelector('#home .panel .button-play').click()");
    await charlie.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Charlie joined the room!");

    // 5. Verify Player List Synchronization across all 3 tabs
    console.log("Verifying Player Lists in all 3 tabs...");
    await alice.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 3");
    await bob.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 3");
    await charlie.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 3");
    await new Promise(r => setTimeout(r, 500));
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/gameplay_3players_room.png");

    const alicePlayerNames = await alice.eval("Array.from(document.querySelectorAll('#game-players .player-name')).map(e => e.textContent.replace(' (You)', ''))");
    console.log("Player list in Alice's tab:", alicePlayerNames);
    if (!alicePlayerNames.includes("Alice") || !alicePlayerNames.includes("Bob") || !alicePlayerNames.includes("Charlie")) {
      throw new Error("Player names mismatch in Alice tab!");
    }

    // 6. Host starts game
    console.log("Alice (Host) starts the game...");
    await alice.eval("document.querySelector('#button-start-game').click()");

    // 7. Wait for Word Selection Phase
    console.log("Waiting for Word Selection phase...");
    let drawerTab = null;
    let guesserTab = null;
    const startWait = Date.now();
    while (Date.now() - startWait < 20000) {
      const a = await alice.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length");
      const b = await bob.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length");
      const c = await charlie.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length");
      if (a > 0) { drawerTab = alice; guesserTab = bob; break; }
      if (b > 0) { drawerTab = bob; guesserTab = alice; break; }
      if (c > 0) { drawerTab = charlie; guesserTab = alice; break; }
      await new Promise(r => setTimeout(r, 400));
    }

    if (!drawerTab) {
      throw new Error("Timeout waiting for drawer word selection phase!");
    }

    await new Promise(r => setTimeout(r, 500));
    await drawerTab.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/gameplay_word_select.png");

    const drawerName = drawerTab === alice ? "Alice" : drawerTab === bob ? "Bob" : "Charlie";
    console.log(`${drawerName} is the drawer!`);

    // Drawer chooses the first word
    const chosenWordText = await drawerTab.eval("document.querySelector('#game-canvas .overlay-content .words .word').textContent");
    console.log("Drawer selected word:", chosenWordText);
    await drawerTab.eval("document.querySelector('#game-canvas .overlay-content .words .word').click()");

    // 8. Wait for Drawing Phase
    console.log("Waiting for active Drawing phase...");
    await drawerTab.waitFor("document.querySelector('#game-word .word').textContent === '" + chosenWordText + "'");
    console.log("Drawing phase active! Secret word displayed to drawer:", chosenWordText);

    // Guesser should see word length underscores
    const hintText = await guesserTab.eval("document.querySelector('#game-word .hints .container').textContent");
    console.log("Guesser sees hint blanks:", hintText);
    if (hintText.length !== chosenWordText.replace(/ /g, '').length) {
      console.warn("Blanks count warning:", hintText.length, "vs", chosenWordText.length);
    }

    // 9. Drawing Synchronization Test
    console.log("Testing drawing stroke synchronization...");
    // Drawer sends drawing commands directly via canvas simulation or stroke
    await drawerTab.eval(`
      const canvas = document.querySelector("#game-canvas canvas");
      const rect = canvas.getBoundingClientRect();
      const pointerDown = new PointerEvent("pointerdown", { clientX: rect.left + 50, clientY: rect.top + 50, pointerId: 1, button: 0, bubbles: true });
      const pointerMove = new PointerEvent("pointermove", { clientX: rect.left + 150, clientY: rect.top + 150, pointerId: 1, button: 0, bubbles: true });
      const pointerUp = new PointerEvent("pointerup", { pointerId: 1, button: 0, bubbles: true });
      canvas.dispatchEvent(pointerDown);
      canvas.dispatchEvent(pointerMove);
      canvas.dispatchEvent(pointerUp);
    `);

    await new Promise(r => setTimeout(r, 600));
    await drawerTab.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/gameplay_drawing_drawer.png");
    await guesserTab.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/gameplay_guessing_guesser.png");

    // 10. Chat and Guessing Test
    console.log("Testing chat and wrong guess...");
    await charlie.eval(`
      const form = document.querySelector("#game-chat form");
      const input = form.querySelector("input");
      input.value = "wrongguess";
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    `);

    // Verify chat message appeared in Alice and Bob tabs
    await alice.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('wrongguess')");
    await bob.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('wrongguess')");
    console.log("Wrong guess chat verified across tabs!");

    // Test correct guess
    console.log("Testing correct guess by Bob...");
    await guesserTab.eval(`
      const form = document.querySelector("#game-chat form");
      const input = form.querySelector("input");
      input.value = "${chosenWordText}";
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    `);

    // Verify correct guess broadcast
    await alice.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('guessed the word')");
    console.log("Correct guess verified across tabs!");

    // 11. Verify Guesser State and Score Update
    console.log("Verifying guesser gets marked as guessed...");
    await guesserTab.waitFor("document.querySelector('#game-players .player-name.me').closest('.player').classList.contains('guessed')");
    console.log("Guesser UI marked as 'guessed'!");
    await new Promise(r => setTimeout(r, 500));
    await guesserTab.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/gameplay_guessed_celebration.png");

    await new Promise(r => setTimeout(r, 500));

    // Have other guesser guess to complete turn
    const otherGuesser = (guesserTab === bob) ? charlie : bob;
    console.log("Second guesser submits correct guess...");
    const secondGuessRes = await otherGuesser.eval(`(() => {
      const form = document.querySelector("#game-chat form");
      const input = form.querySelector("input");
      input.value = "${chosenWordText}";
      form.dispatchEvent(new Event("submit", { cancelable: true }));
      return { val: input.value };
    })()`);
    console.log("Second guess result:", secondGuessRes);

    // Wait for reveal announcement in chat or scores update
    console.log("Waiting for turn end reveal ('The word was ...')...");
    await alice.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('The word was')");
    console.log("Turn end reveal confirmed in chat!");

    await new Promise(r => setTimeout(r, 800));
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/gameplay_turn_reveal.png");

    // Verify updated scores
    await guesserTab.waitFor("parseInt(document.querySelector('#game-players .player-name.me').parentElement.querySelector('.player-score').textContent) > 0");
    const guesserScore = await guesserTab.eval("document.querySelector('#game-players .player-name.me').parentElement.querySelector('.player-score').textContent");
    console.log("Guesser's updated score:", guesserScore);

    // 12. Check Console Logs and Errors in all tabs
    console.log("Verifying zero uncaught exceptions across all client tabs...");
    console.log(`Alice exceptions: ${alice.exceptions.length}`);
    console.log(`Bob exceptions: ${bob.exceptions.length}`);
    console.log(`Charlie exceptions: ${charlie.exceptions.length}`);

    if (alice.exceptions.length > 0 || bob.exceptions.length > 0 || charlie.exceptions.length > 0) {
      console.error("Client exceptions found:", alice.exceptions, bob.exceptions, charlie.exceptions);
      throw new Error("Client thrown exceptions detected during gameplay!");
    }

    console.log("Verifying zero failed network requests...");
    console.log(`Alice failed requests: ${alice.failedRequests.length}`);
    console.log(`Bob failed requests: ${bob.failedRequests.length}`);
    console.log(`Charlie failed requests: ${charlie.failedRequests.length}`);

    if (alice.failedRequests.length > 0 || bob.failedRequests.length > 0 || charlie.failedRequests.length > 0) {
      console.error("Network failures detected:", alice.failedRequests, bob.failedRequests, charlie.failedRequests);
      throw new Error("Network requests failed during gameplay!");
    }

    // 13. Test Disconnect
    console.log("Testing Charlie disconnecting...");
    await charlie.eval("window.location.href = 'about:blank';");
    charlie.close();
    await new Promise(r => setTimeout(r, 1500));

    // Verify player left notification after 30s reconnection grace period expires
    console.log("Waiting for Charlie 30s reconnection grace period to expire...");
    await alice.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('Charlie left the room')", 36000);
    const remainingCount = await alice.eval("document.querySelectorAll('#game-players .players-list .player').length");
    console.log("Remaining players in Alice tab after Charlie left:", remainingCount);
    if (remainingCount !== 2) {
      throw new Error("Expected 2 remaining players after Charlie left!");
    }

    console.log("=== ALL E2E TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("E2E Test Failed:", err);
    if (alice) {
      console.log("=== ALICE CONSOLE LOGS ===", JSON.stringify(alice.consoleLogs, null, 2));
      console.log("=== ALICE EXCEPTIONS ===", JSON.stringify(alice.exceptions, null, 2));
      console.log("=== ALICE FAILED REQUESTS ===", JSON.stringify(alice.failedRequests, null, 2));
    }
    throw err;
  } finally {
    chrome.kill();
  }
}

runE2ETest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
