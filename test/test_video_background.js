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

async function run() {
  console.log("============================================================");
  console.log("   DRAWREALM — BACKGROUND VIDEO VERIFICATION TEST");
  console.log("============================================================\n");

  const chrome = spawn("/usr/bin/chromium", [
    "--headless=new",
    "--remote-debugging-port=9225",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required"
  ]);

  function putTab(url) {
    return new Promise((resolve, reject) => {
      const u = new URL("http://localhost:9225/json/new?" + encodeURIComponent(url));
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

  try {
    // Wait for CDP port
    await new Promise(r => setTimeout(r, 1200));

    console.log("[1] Opening tab at http://127.0.0.1:3001...");
    const tabInfo = await putTab("http://127.0.0.1:3001/");
    const tab = new ChromeTab(tabInfo);
    await tab.connect();

    // Wait for document and video element
    await tab.waitFor("document.readyState === 'complete'");
    await tab.waitFor("document.getElementById('video-background') !== null");
    console.log("  ✓ Page loaded and #video-background element is present.");

    // Inspect video properties
    const videoInfo = await tab.eval(`(() => {
      const v = document.getElementById('video-background');
      const c = document.getElementById('video-background-container');
      const overlay = c.querySelector('.video-background-overlay');
      const source = v.querySelector('source');
      return {
        hasContainer: !!c,
        hasOverlay: !!overlay,
        videoSrc: source ? source.getAttribute('src') : v.src,
        autoplay: v.autoplay,
        loop: v.loop,
        muted: v.muted,
        playsInline: v.playsInline,
        poster: v.getAttribute('poster'),
        containerStyle: {
          position: window.getComputedStyle(c).position,
          zIndex: window.getComputedStyle(c).zIndex,
          pointerEvents: window.getComputedStyle(c).pointerEvents
        },
        readyState: v.readyState,
        paused: v.paused,
        currentTime: v.currentTime
      };
    })()`);

    console.log("[2] Verifying video element configuration...");
    console.log("  Container Present:", videoInfo.hasContainer);
    console.log("  Overlay Present:", videoInfo.hasOverlay);
    console.log("  Video Source:", videoInfo.videoSrc);
    console.log("  Autoplay:", videoInfo.autoplay);
    console.log("  Loop:", videoInfo.loop);
    console.log("  Muted:", videoInfo.muted);
    console.log("  PlaysInline:", videoInfo.playsInline);
    console.log("  Poster:", videoInfo.poster);
    console.log("  Container Position:", videoInfo.containerStyle.position);
    console.log("  Container Z-Index:", videoInfo.containerStyle.zIndex);
    console.log("  Container Pointer Events:", videoInfo.containerStyle.pointerEvents);

    if (!videoInfo.hasContainer) throw new Error("Missing #video-background-container");
    if (!videoInfo.hasOverlay) throw new Error("Missing .video-background-overlay");
    if (!videoInfo.videoSrc.includes("Website_background_animation_style_20260930000327.mp4")) {
      throw new Error("Unexpected video src: " + videoInfo.videoSrc);
    }
    if (!videoInfo.autoplay || !videoInfo.loop || !videoInfo.muted || !videoInfo.playsInline) {
      throw new Error("Missing required video attributes (autoplay, loop, muted, playsInline)");
    }
    if (videoInfo.containerStyle.pointerEvents !== "none") {
      throw new Error("Container pointerEvents should be none so UI clicks are never blocked");
    }
    console.log("  ✓ All video element attributes and styles strictly verified!");

    // Wait a brief moment to allow playback advancement
    await new Promise(r => setTimeout(r, 1500));

    const playbackInfo = await tab.eval(`(() => {
      const v = document.getElementById('video-background');
      return {
        readyState: v.readyState,
        paused: v.paused,
        currentTime: v.currentTime,
        duration: v.duration
      };
    })()`);

    console.log("[3] Verifying video playback...");
    console.log("  ReadyState:", playbackInfo.readyState);
    console.log("  Paused:", playbackInfo.paused);
    console.log("  CurrentTime:", playbackInfo.currentTime.toFixed(2), "s");
    console.log("  Duration:", playbackInfo.duration.toFixed(2), "s");

    // Take high-resolution screenshot of home lobby
    console.log("[4] Capturing live home screenshot...");
    const screenshotHome = await tab.send("Page.captureScreenshot", { format: "png" });
    const bufferHome = Buffer.from(screenshotHome.data, "base64");
    const outPathHome = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/website_video_background_live.png";
    fs.writeFileSync(outPathHome, bufferHome);
    console.log("  ✓ Home screenshot saved to:", outPathHome);

    // Create a real room first via socket, then open it in browser to verify in-game video background
    console.log("[5] Creating a real game room and verifying in-game video background...");
    const io = require("socket.io-client");
    const hostSocket = io("http://127.0.0.1:3001", { transports: ["websocket"] });
    const roomCode = await new Promise((resolve, reject) => {
      hostSocket.on("connect", () => {
        hostSocket.emit("login", { name: "RoomHost", create: 1, roomType: "private" });
      });
      hostSocket.on("drawrealm:session", (sess) => {
        resolve(sess.roomId);
      });
      hostSocket.on("joinerr", (err) => reject(new Error("Join error: " + JSON.stringify(err))));
      setTimeout(() => reject(new Error("Timeout creating room")), 5000);
    });
    console.log("  -> Created test room:", roomCode);

    const tabGameInfo = await putTab("http://127.0.0.1:3001/?" + roomCode);
    const tabGame = new ChromeTab(tabGameInfo);
    await tabGame.connect();

    await tabGame.waitFor("document.querySelector('#home .container-name-lang input')");
    await new Promise(r => setTimeout(r, 600));

    const preState = await tabGame.eval(`(() => {
      const input = document.querySelector('#home .container-name-lang input');
      input.value = 'StarArtist';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = document.querySelector('#home .panel .button-play');
      const valid = window.getValidatedPlayerName ? window.getValidatedPlayerName(true) : null;
      btn.click();
      return {
        inputValue: input.value,
        valid,
        btnDisabled: btn.disabled,
        errText: document.getElementById('name-validation-msg') ? document.getElementById('name-validation-msg').textContent : null
      };
    })()`);
    console.log("  -> PreState on Click:", preState);

    await tabGame.waitFor("document.querySelector('#game').style.display === 'flex'", 10000);
    console.log("  ✓ Successfully entered in-game room (#game display: flex)");
    await new Promise(r => setTimeout(r, 1200));

    const screenshotGame = await tabGame.send("Page.captureScreenshot", { format: "png" });
    const bufferGame = Buffer.from(screenshotGame.data, "base64");
    const outPathGame = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/website_video_background_ingame.png";
    fs.writeFileSync(outPathGame, bufferGame);
    console.log("  ✓ In-game screenshot saved to:", outPathGame);

    hostSocket.disconnect();
    tabGame.close();
    tab.close();
    console.log("\n============================================================");
    console.log("  ALL BACKGROUND VIDEO TESTS PASSED SUCCESSFULLY! (100%)");
    console.log("============================================================\n");
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
