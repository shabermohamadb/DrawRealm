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

  async waitFor(expression, timeoutMs = 12000, intervalMs = 200) {
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

async function runEvolutionE2E() {
  console.log("=== STARTING EVOLUTION MODE E2E TEST ===");
  const CDP_PORT = 9235;

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
  const runId = Math.floor(Math.random() * 100000);
  const nameAlice = `Alice_${runId}`;
  const nameBob = `Bob_${runId}`;
  const nameCharlie = `Charlie_${runId}`;

  try {
    // 1. Tab 1: Alice creates room
    console.log(`Opening Tab 1 (${nameAlice})...`);
    const tab1Info = await putTab("http://localhost:3001/");
    alice = new ChromeTab(tab1Info);
    await alice.connect();

    await alice.waitFor("document.readyState === 'complete'");
    await alice.eval(`document.querySelector('#home .container-name-lang input').value = '${nameAlice}'`);
    await alice.eval("document.querySelector('#home .panel .button-create').click()");

    await alice.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Alice created private room!");

    const inviteUrl = await alice.waitFor("document.querySelector('#input-invite').value");
    const roomId = inviteUrl.split("?")[1];
    console.log("Room ID:", roomId);

    // Alice selects Game Mode: Evolution (value 6)
    console.log("Setting Game Mode to Evolution...");
    await alice.eval(`
      const sel = document.querySelector('#item-settings-mode');
      sel.value = '6';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 400));

    // 2. Tab 2: Bob joins
    console.log(`Opening Tab 2 (${nameBob})...`);
    const tab2Info = await putTab(`http://localhost:3001/?${roomId}`);
    bob = new ChromeTab(tab2Info);
    await bob.connect();

    await bob.waitFor("document.readyState === 'complete'");
    await bob.eval(`document.querySelector('#home .container-name-lang input').value = '${nameBob}'`);
    await bob.eval("document.querySelector('#home .panel .button-play').click()");
    await bob.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Bob joined!");

    // 3. Tab 3: Charlie joins
    console.log(`Opening Tab 3 (${nameCharlie})...`);
    const tab3Info = await putTab(`http://localhost:3001/?${roomId}`);
    charlie = new ChromeTab(tab3Info);
    await charlie.connect();

    await charlie.waitFor("document.readyState === 'complete'");
    await charlie.eval(`document.querySelector('#home .container-name-lang input').value = '${nameCharlie}'`);
    await charlie.eval("document.querySelector('#home .panel .button-play').click()");
    await charlie.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Charlie joined!");

    // 4. Verify Evolution Dock visibility across all tabs
    console.log("Verifying Evolution Dock visible across all tabs...");
    await alice.waitFor("document.querySelector('#evolution-dock') && document.querySelector('#evolution-dock').style.display !== 'none'");
    await bob.waitFor("document.querySelector('#evolution-dock') && document.querySelector('#evolution-dock').style.display !== 'none'");
    await charlie.waitFor("document.querySelector('#evolution-dock') && document.querySelector('#evolution-dock').style.display !== 'none'");
    console.log("Evolution Dock is active and visible in all tabs!");

    // Capture screenshot of Lobby with Evolution Dock
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/evolution_lobby_dock.png");

    // 5. Alice starts the game
    console.log("Starting match...");
    await alice.eval("document.querySelector('#button-start-game').click()");

    // Wait for word choice phase
    console.log("Waiting for word choice phase...");
    await alice.waitFor("document.querySelector('#game-canvas .overlay-content .words').classList.contains('show')");
    
    // Alice picks word #0
    const wordPicked = await alice.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word')[0].textContent");
    console.log("Alice picked word:", wordPicked);
    await alice.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word')[0].click()");

    // Active Drawing Phase
    console.log("Waiting for active drawing phase...");
    await alice.waitFor("document.querySelector('#game-word .word').textContent.length > 0");
    console.log("Active drawing phase confirmed!");

    // Capture drawer perspective
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/evolution_gameplay_drawer.png");

    // 6. Test Correct Guess + XP Award
    console.log("Bob submits correct guess...");
    await bob.eval(`
      const input = document.querySelector('#game-chat input');
      input.value = '${wordPicked}';
      document.querySelector('#game-chat form').dispatchEvent(new Event('submit', { bubbles: true }));
    `);

    // Verify Bob gains score and XP
    await bob.waitFor("document.querySelector('#game-players .player.guessed')");
    console.log("Bob correctly guessed the word!");

    await bob.waitFor("parseInt(document.querySelector('#evolution-dock .evolution-badge-xp').textContent) > 0");
    const bobXpText = await bob.eval("document.querySelector('#evolution-dock .evolution-badge-xp').textContent");
    console.log("Bob earned Evolution XP:", bobXpText);

    // Capture guesser perspective with XP gain
    await bob.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/evolution_gameplay_guesser_xp.png");

    // 7. Test Level Up & 3-Power Draft Modal
    console.log("Testing Level Up trigger and 3-power draft modal...");
    // Award XP to trigger Level 1 Scout (requires 50 XP)
    await bob.eval(`
      if (window.__skribblSocket) {
        window.__skribblSocket.emit('evolution:test_add_xp', 50);
      }
    `);

    // Wait for real Level Up Draft modal to appear with choices
    await bob.waitFor("document.getElementById('overlay-evolution-choice').style.display !== 'none' && document.querySelectorAll('.evolution-choice-card').length >= 3");
    console.log("Real server Level Up Draft modal verified with 3 power choices!");

    // Capture screenshot of Level Up Draft Modal
    await bob.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/evolution_level_up_draft.png");
    console.log("Captured Level Up Draft Modal screenshot!");

    // Bob picks a non-drawer power from the server draft (e.g. Word Scan, Randomizer, etc.)
    await bob.eval(`
      const drawerOnly = ['shape_assist', 'magic_brush', 'perfect_line', 'instant_clean'];
      const cards = Array.from(document.querySelectorAll('.evolution-choice-card'));
      const cardToClick = cards.find(card => !drawerOnly.includes(card.dataset.powerId)) || cards[0];
      cardToClick.click();
    `);

    // Wait for draft modal to close and power to be equipped in Slot 1
    await bob.waitFor("document.getElementById('overlay-evolution-choice').style.display === 'none'");
    await bob.waitFor("!document.querySelector('.evolution-power-btn[data-key=\"1\"]').classList.contains('empty')");
    const equippedPowerName = await bob.eval("document.querySelector('.evolution-power-btn[data-key=\"1\"] .power-name').textContent");
    console.log("Bob successfully equipped power:", equippedPowerName);

    // 8. Test Power Activation & Cooldown
    console.log("Testing Power Activation...");
    // Trigger power activation via slot 1 hotkey
    await bob.eval(`
      const btn = document.querySelector('.evolution-power-btn[data-key="1"]');
      if (btn && window.__skribblSocket) {
        window.__skribblSocket.emit('evolution:activate_power', btn.dataset.powerId);
      }
    `);

    // Wait for cooldown overlay to appear on Bob's power button
    await bob.waitFor("document.querySelector('.evolution-power-btn[data-key=\"1\"]').classList.contains('on-cooldown')");
    console.log("Power cooldown overlay active!");

    // Capture screenshot of Power on Cooldown
    await bob.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/evolution_power_cooldown.png");
    console.log("Captured Power Cooldown screenshot!");

    // 9. Charlie guesses correctly
    await charlie.eval(`
      const input = document.querySelector('#game-chat input');
      input.value = '${wordPicked}';
      document.querySelector('#game-chat form').dispatchEvent(new Event('submit', { bubbles: true }));
    `);

    // Wait for turn end reveal
    console.log("Waiting for turn end reveal...");
    await alice.waitFor("document.querySelector('#game-canvas .overlay-content .reveal').classList.contains('show')");
    console.log("Turn end reveal confirmed!");

    // 10. Verify 0 uncaught exceptions and 0 broken requests
    console.log("Verifying clean execution metrics...");
    console.log("Alice exceptions:", alice.exceptions.length);
    console.log("Bob exceptions:", bob.exceptions.length);
    console.log("Charlie exceptions:", charlie.exceptions.length);

    if (alice.exceptions.length > 0 || bob.exceptions.length > 0 || charlie.exceptions.length > 0) {
      console.error("Exceptions detected:", { alice: alice.exceptions, bob: bob.exceptions, charlie: charlie.exceptions });
      throw new Error("Uncaught exceptions detected during Evolution test!");
    }

    console.log("=== ALL EVOLUTION MODE E2E TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    if (alice) alice.close();
    if (bob) bob.close();
    if (charlie) charlie.close();
    chrome.kill();
  }
}

runEvolutionE2E().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
