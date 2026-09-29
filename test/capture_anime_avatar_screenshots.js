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

async function capture() {
  const CDP_PORT = 9289;
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

  const ARTIFACT_DIR = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa";

  try {
    // 1. Showcase Page Screenshot
    console.log("Loading Showcase HTML...");
    const showcasePath = "file://" + path.join(__dirname, "anime_avatar_showcase.html");
    const tab1Info = await putTab(showcasePath);
    const tab1 = new ChromeTab(tab1Info);
    await tab1.connect();
    await tab1.waitFor("document.querySelectorAll('#avatarGrid .card').length >= 16");
    await new Promise(r => setTimeout(r, 800));
    await tab1.captureScreenshot(path.join(ARTIFACT_DIR, "anime_avatar_showcase.png"));
    tab1.close();

    // 2. Home Page Avatar Customizer Screenshot
    console.log("Loading Home Page...");
    const tab2Info = await putTab("http://localhost:3001/");
    const tab2 = new ChromeTab(tab2Info);
    await tab2.connect();
    await tab2.waitFor("document.querySelector('#home .avatar .color')");
    await new Promise(r => setTimeout(r, 800));
    await tab2.captureScreenshot(path.join(ARTIFACT_DIR, "anime_avatars_home.png"));

    // Cycle through a few avatars using arrows & randomize
    console.log("Cycling avatar on home page...");
    await tab2.eval("document.querySelector('.avatar-customizer .randomize').click()");
    await new Promise(r => setTimeout(r, 400));
    await tab2.captureScreenshot(path.join(ARTIFACT_DIR, "anime_avatars_home_cycled.png"));

    // 3. Create room and capture in-game lobby player card
    console.log("Creating room to inspect in-game player card...");
    await tab2.eval("document.querySelector('#home .container-name-lang input').value = 'AnimeHero'");
    await tab2.eval("document.querySelector('#home .panel .button-create').click()");
    await tab2.waitFor("document.querySelector('#game').style.display === 'flex'");
    await new Promise(r => setTimeout(r, 800));
    await tab2.captureScreenshot(path.join(ARTIFACT_DIR, "anime_avatars_ingame_lobby.png"));
    tab2.close();

    console.log("All screenshots captured successfully!");
  } finally {
    chrome.kill();
  }
}

capture().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
