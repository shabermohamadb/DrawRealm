const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa";

async function main() {
  const CDP_PORT = 9270;
  console.log("Launching Chromium on port", CDP_PORT);
  const chrome = spawn('chromium', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`
  ]);

  await new Promise(r => setTimeout(r, 1500));

  function putTab(url) {
    return new Promise((res, rej) => {
      const u = new URL(`http://127.0.0.1:${CDP_PORT}/json/new?${url}`);
      const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT' }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      });
      req.on('error', rej); req.end();
    });
  }

  // 1. Capture 28-character showcase matrix
  const showcaseTab = await putTab('file:///home/shaber/skribbl.io/test/anime_avatar_showcase.html');
  const wsShowcase = new WebSocket(showcaseTab.webSocketDebuggerUrl);
  await new Promise(r => wsShowcase.onopen = r);

  let id = 1;
  const cbs = new Map();
  wsShowcase.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && cbs.has(m.id)) { cbs.get(m.id)(m.result); cbs.delete(m.id); }
  };
  function sendShowcase(method, params = {}) {
    return new Promise(r => { const mid = id++; cbs.set(mid, r); wsShowcase.send(JSON.stringify({ id: mid, method, params })); });
  }

  await sendShowcase('Page.enable');
  await sendShowcase('Runtime.enable');
  await sendShowcase('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });

  await new Promise(r => setTimeout(r, 1200));

  const shotShowcase = await sendShowcase('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'anime_avatar_28_matrix.png'), Buffer.from(shotShowcase.data, 'base64'));
  console.log("✓ Captured anime_avatar_28_matrix.png");

  wsShowcase.close();

  // 2. Capture Home Screen with Avatar Customizer
  const homeTab = await putTab('http://localhost:3001/');
  const wsHome = new WebSocket(homeTab.webSocketDebuggerUrl);
  await new Promise(r => wsHome.onopen = r);

  let homeId = 1;
  const homeCbs = new Map();
  wsHome.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && homeCbs.has(m.id)) { homeCbs.get(m.id)(m.result); homeCbs.delete(m.id); }
  };
  function sendHome(method, params = {}) {
    return new Promise(r => { const mid = homeId++; homeCbs.set(mid, r); wsHome.send(JSON.stringify({ id: mid, method, params })); });
  }

  await sendHome('Page.enable');
  await sendHome('Runtime.enable');
  await sendHome('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await new Promise(r => setTimeout(r, 1200));

  const shotHome = await sendHome('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'anime_avatar_home_preview.png'), Buffer.from(shotHome.data, 'base64'));
  console.log("✓ Captured anime_avatar_home_preview.png");

  // Cycle avatar customizer a few times to show different hairstyles on home screen
  await sendHome('Runtime.evaluate', { expression: "document.querySelector('#home .container-customizer .arrow-right').click()" });
  await new Promise(r => setTimeout(r, 300));
  await sendHome('Runtime.evaluate', { expression: "document.querySelector('#home .container-customizer .arrow-right').click()" });
  await new Promise(r => setTimeout(r, 300));

  const shotHomeCycled = await sendHome('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'anime_avatar_home_cycled.png'), Buffer.from(shotHomeCycled.data, 'base64'));
  console.log("✓ Captured anime_avatar_home_cycled.png");

  wsHome.close();
  chrome.kill();
  console.log("All screenshots captured successfully!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
