
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const io = require("socket.io-client");

const ARTIFACTS_DIR = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa";

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
    throw new Error("Timeout waiting for " + expression);
  }

  async capture(outName) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(shot.data, "base64");
    const outPath = path.join(ARTIFACTS_DIR, outName);
    fs.writeFileSync(outPath, buffer);
    console.log("  [SAVED SCREENSHOT]:", outPath);
    return outPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

function putTab(port, url) {
  return new Promise((resolve, reject) => {
    const u = new URL("http://localhost:" + port + "/json/new?" + encodeURIComponent(url));
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

async function run() {
  console.log("=== DRAWREALM AVATAR ACCESSORIES VISUAL VERIFICATION ===");
  const CDP_PORT = 9227;
  const chrome = spawn("/usr/bin/chromium", [
    "--headless=new",
    "--remote-debugging-port=" + CDP_PORT,
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars"
  ]);

  try {
    await new Promise(r => setTimeout(r, 1500));

    console.log("\n[1] Navigating to DrawRealm home page...");
    const tabInfo = await putTab(CDP_PORT, "http://127.0.0.1:3001/");
    const tab = new ChromeTab(tabInfo);
    await tab.connect();

    await tab.waitFor("document.readyState === 'complete'");
    await tab.waitFor("document.querySelector('.accessory-selector-container') !== null");
    console.log("  ✓ Accessory selector container loaded.");

    // Screenshot 1: Royal Crown (Head)
    console.log("\n[2] Selecting Royal Crown (Headwear)...");
    await tab.eval(`(() => {
      window.DrawRealmAccessories.selectAccessory("crown");
      const io = document.querySelector("#home .avatar-customizer .container .avatar");
      if (io && window.l) {
        window.l.avatar[4] = "crown";
        window.ue(io, window.l.avatar);
      }
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await tab.capture("avatar_accessory_crown.png");

    // Screenshot 2: Cyber Glasses (Face)
    console.log("\n[3] Selecting Cyber Glasses (Face / Eyewear)...");
    await tab.eval(`(() => {
      window.DrawRealmAccessories.selectAccessory("cyber_glasses");
      const io = document.querySelector("#home .avatar-customizer .container .avatar");
      if (io && window.l) {
        window.l.avatar[4] = "cyber_glasses";
        window.ue(io, window.l.avatar);
      }
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await tab.capture("avatar_accessory_cyber_glasses.png");

    // Screenshot 3: Small Wings (Special / Back Item)
    console.log("\n[4] Selecting Small Wings (Special / Back Layer)...");
    await tab.eval(`(() => {
      window.DrawRealmAccessories.selectAccessory("small_wings");
      const io = document.querySelector("#home .avatar-customizer .container .avatar");
      if (io && window.l) {
        window.l.avatar[4] = "small_wings";
        window.ue(io, window.l.avatar);
      }
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await tab.capture("avatar_accessory_small_wings.png");

    // Screenshot 4: Angel Halo (Special / Front Layer)
    console.log("\n[5] Selecting Angel Halo (Special / Front Layer)...");
    await tab.eval(`(() => {
      window.DrawRealmAccessories.selectAccessory("angel_halo");
      const io = document.querySelector("#home .avatar-customizer .container .avatar");
      if (io && window.l) {
        window.l.avatar[4] = "angel_halo";
        window.ue(io, window.l.avatar);
      }
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await tab.capture("avatar_accessory_angel_halo.png");

    // Screenshot 5: In-Game Lobby with Multiple Player Accessories
    console.log("\n[6] Setting up Multiplayer Lobby with Host & Guest Accessories...");
    const hostSock = io("http://127.0.0.1:3001", { transports: ["websocket"] });
    const guestSock = io("http://127.0.0.1:3001", { transports: ["websocket"] });

    const roomData = await new Promise((resolve, reject) => {
      hostSock.on("connect", () => {
        hostSock.emit("login", {
          name: "Valkyrie",
          create: 1,
          roomType: "private",
          avatar: [0, 4, 8, -1, "crown", 0]
        });
      });
      hostSock.on("data", (packet) => {
        if (packet && packet.id === 10) resolve(packet.data);
      });
      setTimeout(() => reject(new Error("Timeout creating room")), 6000);
    });

    const roomId = roomData.id;
    console.log("  ✓ Created lobby:", roomId);

    // Guest joins with wings
    guestSock.emit("login", {
      name: "Seraphim",
      create: 0,
      join: roomId,
      avatar: [5, 12, 18, -1, "small_wings", 0]
    });

    await new Promise(r => setTimeout(r, 1000));

    // Connect browser tab to this room as 3rd player (CyberNinja with cyber_glasses)
    console.log("  Connecting browser tab into room as CyberNinja...");
    const gameTabInfo = await putTab(CDP_PORT, "http://127.0.0.1:3001/?" + roomId);
    const gameTab = new ChromeTab(gameTabInfo);
    await gameTab.connect();

    await gameTab.waitFor("document.querySelector('#home .container-name-lang input')");
    await new Promise(r => setTimeout(r, 600));

    await gameTab.eval(`(() => {
      const input = document.querySelector("#home .container-name-lang input");
      input.value = "CyberNinja";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      window.DrawRealmAccessories.selectAccessory("cyber_glasses");
      const io = document.querySelector("#home .avatar-customizer .container .avatar");
      if (io && window.l) {
        window.l.avatar[4] = "cyber_glasses";
        window.ue(io, window.l.avatar);
      }
      const btn = document.querySelector("#home .panel .button-play");
      btn.click();
    })()`);

    await gameTab.waitFor("document.querySelector('#game').style.display === 'flex'", 8000);
    console.log("  ✓ Browser tab in-game (#game displayed). Waiting for player list to render...");
    await new Promise(r => setTimeout(r, 1500));

    await gameTab.capture("avatar_accessories_ingame_lobby.png");

    hostSock.disconnect();
    guestSock.disconnect();
    gameTab.close();
    tab.close();
    console.log("\n=== VISUAL VERIFICATION COMPLETE! ===");
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error("Visual verification failed:", err);
  process.exit(1);
});
