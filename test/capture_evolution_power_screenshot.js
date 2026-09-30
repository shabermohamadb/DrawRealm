const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

class ChromeTab {
  constructor(tabInfo) {
    this.id = tabInfo.id;
    this.wsUrl = tabInfo.webSocketDebuggerUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
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
      console.log(`Saved screenshot: ${filepath}`);
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
    return res && res.result ? res.result.value : null;
  }

  async waitFor(expression, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const val = await this.eval(expression);
      if (val) return val;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Timeout waiting for ${expression}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function capture() {
  const chrome = spawn("/usr/bin/chromium", [
    "--headless=new",
    "--remote-debugging-port=9223",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars"
  ]);

  await new Promise(r => setTimeout(r, 1000));

  function putTab(url) {
    return new Promise((resolve, reject) => {
      const u = new URL("http://localhost:9223/json/new?" + encodeURIComponent(url));
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

  const ARTIFACT_DIR = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa";

  try {
    console.log("Loading Home Page...");
    const tabInfo = await putTab("http://localhost:3001/");
    const tab = new ChromeTab(tabInfo);
    await tab.connect();
    await tab.waitFor("document.querySelector('#home .container-name-lang input')");

    // Enter name & create room
    await tab.eval("document.querySelector('#home .container-name-lang input').value = 'EvoChampion'");
    await tab.eval("document.querySelector('#home .panel .button-create').click()");
    await tab.waitFor("document.querySelector('#game').style.display === 'flex'");
    await new Promise(r => setTimeout(r, 800));

    // First: Capture standard mode (Evolution inactive) to verify original bar
    await tab.captureScreenshot(path.join(ARTIFACT_DIR, "evolution_bar_standard_mode.png"));
    console.log("Saved standard mode screenshot: evolution_bar_standard_mode.png");

    // Switch word mode to Evolution (index 6, value 6)
    console.log("Switching to Evolution Mode...");
    await tab.eval(`
      const sel = document.querySelector('select[data-setting="6"]') || document.querySelectorAll('#game-settings select')[5];
      if (sel) {
        sel.value = "6";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    `);
    await new Promise(r => setTimeout(r, 600));

    // Grant 1500 XP to see higher level, equipped powers & ultimate slot
    await tab.eval(`
      if (window.__skribblSocket) {
        window.__skribblSocket.emit("evolution:test_add_xp", 1500);
      }
    `);
    await new Promise(r => setTimeout(r, 800));

    // Close any open modals and simulate active guessing phase text
    await tab.eval(`
      document.querySelectorAll('[id*="modal"], [id*="draft"], .modal-overlay').forEach(el => {
        el.style.display = 'none';
      });
      const desc = document.querySelector('#game-word .description');
      if (desc) desc.textContent = 'GUESS THIS';
      const hintsCont = document.querySelector('#game-word .hints .container');
      if (hintsCont) {
        hintsCont.innerHTML = '<span class="hint">_</span><span class="hint">_</span><span class="hint">_</span><span class="hint">_</span><span class="hint">_</span>';
      }
    `);
    await new Promise(r => setTimeout(r, 400));

    // 1. Capture clean desktop view
    await tab.captureScreenshot(path.join(ARTIFACT_DIR, "evolution_powers_ingame.png"));
    console.log("Saved desktop view: evolution_powers_ingame.png");

    // 2. Capture mobile viewport
    await tab.send("Emulation.setDeviceMetricsOverride", {
      width: 480,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 500));
    await tab.captureScreenshot(path.join(ARTIFACT_DIR, "evolution_powers_mobile.png"));
    console.log("Saved mobile view: evolution_powers_mobile.png");

    tab.close();
    console.log("All screenshots captured successfully!");
  } finally {
    chrome.kill();
  }
}

capture().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

