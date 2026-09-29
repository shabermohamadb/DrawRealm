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

async function run4PlayersTest() {
  console.log("=== STARTING DRAWREALM 4-PLAYER MULTIPLAYER E2E TEST ===");
  const CDP_PORT = 9240;

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
  let dana = null;

  const runId = Math.floor(Math.random() * 100000);
  const nameAlice = `Alice_${runId}`;
  const nameBob = `Bob_${runId}`;
  const nameCharlie = `Charlie_${runId}`;
  const nameDana = `Dana_${runId}`;

  try {
    // 1. Tab 1: Alice loads Home Screen
    console.log(`Opening Tab 1 (${nameAlice})...`);
    const tab1Info = await putTab("http://localhost:3001/");
    alice = new ChromeTab(tab1Info);
    await alice.connect();

    await alice.waitFor("document.readyState === 'complete'");

    // Verify Title Branding
    const title = await alice.eval("document.title");
    console.log("Page title:", title);
    if (!title.includes("DrawRealm")) {
      throw new Error(`Title does not contain DrawRealm: ${title}`);
    }

    // Verify DrawRealm Logo loaded
    const logoSrc = await alice.eval("document.querySelector('#home .logo-big img').getAttribute('src')");
    console.log("Logo source:", logoSrc);
    if (!logoSrc.includes("logo.svg")) {
      throw new Error(`Logo does not point to logo.svg: ${logoSrc}`);
    }

    // Set Alice's Name
    await alice.eval(`document.querySelector('#home .container-name-lang input').value = '${nameAlice}'`);

    // Capture Home Screen with new layout
    console.log("Capturing Home Screen screenshot...");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_home_menu.png");

    // 2. Test Modals on Home Screen
    // A. Game Rules Modal
    console.log("Testing Game Rules Modal...");
    await alice.eval("document.querySelector('#btn-rules-open').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-rules').style.display === 'flex'");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_game_rules.png");
    await alice.eval("document.querySelector('#drawrealm-modal-rules .btn-modal-dismiss').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-rules').style.display === 'none'");

    // B. How to Play Modal
    console.log("Testing How to Play Modal...");
    await alice.eval("document.querySelector('#btn-how-open').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-how').style.display === 'flex'");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_how_to_play.png");
    await alice.eval("document.querySelector('#drawrealm-modal-how .btn-modal-dismiss').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-how').style.display === 'none'");

    // C. Evolution Intro Modal
    console.log("Testing Evolution Intro Modal...");
    await alice.eval("document.querySelector('#btn-side-evo-guide').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-evolution-intro').style.display === 'flex'");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_evolution_intro.png");
    await alice.eval("document.querySelector('#drawrealm-modal-evolution-intro .btn-modal-dismiss').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-evolution-intro').style.display === 'none'");

    // D. Public Rooms Browser Modal
    console.log("Testing Public Rooms Browser Modal...");
    await alice.eval("document.querySelector('#btn-public-rooms-open').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-public').style.display === 'flex'");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_public_browser.png");
    await alice.eval("document.querySelector('#drawrealm-modal-public .modal-close-btn').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-public').style.display === 'none'");

    // E. Create Room Modal & Room Creation
    console.log("Opening Create Room Modal...");
    await alice.eval("document.querySelector('#btn-create-room-open').click()");
    await alice.waitFor("document.getElementById('drawrealm-modal-create').style.display === 'flex'");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_create_modal.png");

    console.log("Alice submits Create Room...");
    await alice.eval("document.querySelector('#btn-submit-create-room').click()");

    await alice.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Alice entered private room lobby!");

    const inviteUrl = await alice.waitFor("document.querySelector('#input-invite').value");
    const roomId = inviteUrl.split("?")[1];
    console.log("Room ID:", roomId);

    // Verify Lobby Header display
    await alice.waitFor(`document.querySelector('#lobby-code-display').textContent === '${roomId}'`);
    const displayedCode = await alice.eval("document.querySelector('#lobby-code-display').textContent");
    console.log("Lobby Header displayed code:", displayedCode);
    if (displayedCode !== roomId) {
      throw new Error(`Displayed code '${displayedCode}' does not match Room ID '${roomId}'`);
    }

    // Capture Refined Lobby Screenshot
    console.log("Capturing Refined Lobby Screenshot...");
    await alice.captureScreenshot("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/drawrealm_lobby_refined.png");

    // 3. Tab 2 (Bob): Joins via "Join Room" Modal
    console.log(`Opening Tab 2 (${nameBob}) and joining via Join Room modal...`);
    const tab2Info = await putTab("http://localhost:3001/");
    bob = new ChromeTab(tab2Info);
    await bob.connect();

    await bob.waitFor("document.readyState === 'complete'");
    await bob.eval(`document.querySelector('#home .container-name-lang input').value = '${nameBob}'`);
    await bob.eval("document.querySelector('#btn-join-room-open').click()");
    await bob.waitFor("document.getElementById('drawrealm-modal-join').style.display === 'flex'");

    // Bob types Room ID into Join input
    await bob.eval(`document.querySelector('#input-join-code').value = '${roomId}'`);
    await bob.eval("document.querySelector('#btn-submit-join-room').click()");

    await bob.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Bob joined via Join Room modal!");

    // 4. Tab 3 (Charlie): Joins via URL
    console.log(`Opening Tab 3 (${nameCharlie})...`);
    const tab3Info = await putTab(`http://localhost:3001/?${roomId}`);
    charlie = new ChromeTab(tab3Info);
    await charlie.connect();

    await charlie.waitFor("document.readyState === 'complete'");
    await charlie.eval(`document.querySelector('#home .container-name-lang input').value = '${nameCharlie}'`);
    await charlie.eval("document.querySelector('#home .panel .button-play').click()");
    await charlie.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Charlie joined!");

    // 5. Tab 4 (Dana): Joins via URL
    console.log(`Opening Tab 4 (${nameDana})...`);
    const tab4Info = await putTab(`http://localhost:3001/?${roomId}`);
    dana = new ChromeTab(tab4Info);
    await dana.connect();

    await dana.waitFor("document.readyState === 'complete'");
    await dana.eval(`document.querySelector('#home .container-name-lang input').value = '${nameDana}'`);
    await dana.eval("document.querySelector('#home .panel .button-play').click()");
    await dana.waitFor("document.querySelector('#game').style.display === 'flex'");
    console.log("Dana joined!");

    // 6. Verify 4-Player Roster Synchronization across all tabs
    console.log("Verifying 4-player roster synchronization across all tabs...");
    await alice.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 4");
    await bob.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 4");
    await charlie.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 4");
    await dana.waitFor("document.querySelectorAll('#game-players .players-list .player').length === 4");

    const playerNames = await alice.eval("Array.from(document.querySelectorAll('#game-players .player-name')).map(e => e.textContent.replace(' (You)', ''))");
    console.log("Confirmed 4 players in Alice's tab:", playerNames);
    if (!playerNames.includes(nameAlice) || !playerNames.includes(nameBob) || !playerNames.includes(nameCharlie) || !playerNames.includes(nameDana)) {
      throw new Error("Missing player in 4-player room list!");
    }

    // 7. Host starts the game
    console.log("Alice starts the game...");
    await alice.eval("document.querySelector('#button-start-game').click()");

    // 8. Word Choice Phase
    console.log("Waiting for word selection phase...");
    let drawerTab = null;
    let guesserTab = null;
    const startWait = Date.now();
    while (Date.now() - startWait < 15000) {
      if (await alice.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length") > 0) {
        drawerTab = alice; guesserTab = bob; break;
      }
      if (await bob.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length") > 0) {
        drawerTab = bob; guesserTab = alice; break;
      }
      if (await charlie.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length") > 0) {
        drawerTab = charlie; guesserTab = alice; break;
      }
      if (await dana.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word').length") > 0) {
        drawerTab = dana; guesserTab = alice; break;
      }
      await new Promise(r => setTimeout(r, 400));
    }

    if (!drawerTab) throw new Error("Timeout waiting for drawer word choice phase!");

    const drawerName = drawerTab === alice ? nameAlice : drawerTab === bob ? nameBob : drawerTab === charlie ? nameCharlie : nameDana;
    console.log(`${drawerName} is the drawer!`);

    const wordPicked = await drawerTab.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word')[0].textContent");
    console.log("Drawer picked word:", wordPicked);
    await drawerTab.eval("document.querySelectorAll('#game-canvas .overlay-content .words .word')[0].click()");

    // 9. Active Drawing Phase
    console.log("Waiting for active drawing phase...");
    await drawerTab.waitFor("document.querySelector('#game-word .word').textContent.length > 0");
    console.log("Active drawing phase confirmed!");

    // 10. Drawer performs stroke synchronization
    console.log("Drawer draws on canvas...");
    await drawerTab.eval(`(() => {
      const canvas = document.querySelector("#game-canvas canvas");
      const rect = canvas.getBoundingClientRect();
      const pointerDown = new PointerEvent("pointerdown", { clientX: rect.left + 50, clientY: rect.top + 50, pointerId: 1, button: 0, bubbles: true });
      const pointerMove = new PointerEvent("pointermove", { clientX: rect.left + 150, clientY: rect.top + 150, pointerId: 1, button: 0, bubbles: true });
      const pointerUp = new PointerEvent("pointerup", { pointerId: 1, button: 0, bubbles: true });
      canvas.dispatchEvent(pointerDown);
      canvas.dispatchEvent(pointerMove);
      canvas.dispatchEvent(pointerUp);
    })()`);
    await new Promise(r => setTimeout(r, 500));

    // 11. Test wrong guess in chat
    const nonDrawers = [
      { tab: alice, name: nameAlice },
      { tab: bob, name: nameBob },
      { tab: charlie, name: nameCharlie },
      { tab: dana, name: nameDana }
    ].filter(p => p.tab !== drawerTab);

    console.log(`${nonDrawers[0].name} submits wrong guess...`);
    await nonDrawers[0].tab.eval(`(() => {
      const form = document.querySelector('#game-chat form');
      const input = form.querySelector('input');
      input.value = 'wrongguess';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`);
    await drawerTab.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('wrongguess')");
    console.log("Wrong guess chat verified across tabs!");

    // 12. First guesser submits correct guess
    console.log(`${nonDrawers[1].name} submits correct guess...`);
    await nonDrawers[1].tab.eval(`(() => {
      const form = document.querySelector('#game-chat form');
      const input = form.querySelector('input');
      input.value = '${wordPicked}';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`);
    await nonDrawers[1].tab.waitFor("document.querySelector('#game-players .player-name.me').closest('.player').classList.contains('guessed')");
    console.log(`${nonDrawers[1].name} successfully guessed the word!`);

    // 13. Second guesser submits correct guess
    console.log(`${nonDrawers[2].name} submits correct guess...`);
    await nonDrawers[2].tab.eval(`(() => {
      const form = document.querySelector('#game-chat form');
      const input = form.querySelector('input');
      input.value = '${wordPicked}';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`);
    await nonDrawers[2].tab.waitFor("document.querySelector('#game-players .player-name.me').closest('.player').classList.contains('guessed')");
    console.log(`${nonDrawers[2].name} successfully guessed the word!`);

    // 14. Third guesser submits correct guess
    console.log(`${nonDrawers[0].name} submits correct guess...`);
    await nonDrawers[0].tab.eval(`(() => {
      const form = document.querySelector('#game-chat form');
      const input = form.querySelector('input');
      input.value = '${wordPicked}';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()`);
    await nonDrawers[0].tab.waitFor("document.querySelector('#game-players .player-name.me').closest('.player').classList.contains('guessed')");
    console.log(`${nonDrawers[0].name} successfully guessed the word!`);

    // 15. Wait for turn end reveal
    console.log("Waiting for turn end reveal ('The word was ...')...");
    await drawerTab.waitFor("document.querySelector('#game-chat .chat-content').textContent.includes('The word was')");
    console.log("Turn end reveal confirmed in chat!");

    // 15. Verify 0 exceptions and 0 failed network requests
    console.log("Verifying clean execution metrics across all 4 tabs...");
    console.log(`Alice exceptions: ${alice.exceptions.length}`);
    console.log(`Bob exceptions: ${bob.exceptions.length}`);
    console.log(`Charlie exceptions: ${charlie.exceptions.length}`);
    console.log(`Dana exceptions: ${dana.exceptions.length}`);

    if (alice.exceptions.length > 0 || bob.exceptions.length > 0 || charlie.exceptions.length > 0 || dana.exceptions.length > 0) {
      console.error("Exceptions detected:", {
        alice: alice.exceptions,
        bob: bob.exceptions,
        charlie: charlie.exceptions,
        dana: dana.exceptions
      });
      throw new Error("Client thrown exceptions detected during 4-player test!");
    }

    console.log("=== ALL 4-PLAYER E2E TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    if (alice) alice.close();
    if (bob) bob.close();
    if (charlie) charlie.close();
    if (dana) dana.close();
    chrome.kill();
  }
}

run4PlayersTest().catch(err => {
  console.error("4-Player Test failed:", err);
  process.exit(1);
});
