const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const ARTIFACT_DIR = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa";

async function main() {
  const CDP_PORT = 9280;
  const chrome = spawn('chromium', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${CDP_PORT}`
  ]);

  await new Promise(r => setTimeout(r, 1200));

  function putTab(url) {
    return new Promise((res, rej) => {
      const u = new URL(`http://127.0.0.1:${CDP_PORT}/json/new?${url}`);
      const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT' }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      });
      req.on('error', rej); req.end();
    });
  }

  const tab = await putTab('http://localhost:3001/');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const cbs = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && cbs.has(m.id)) { cbs.get(m.id)(m.result); cbs.delete(m.id); } };
  function send(method, params = {}) { return new Promise(r => { const mid = id++; cbs.set(mid, r); ws.send(JSON.stringify({ id: mid, method, params })); }); }
  async function evalExpr(expr) { const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return res && res.result ? res.result.value : undefined; }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await evalExpr("document.querySelector('#home .container-name-lang input').value = 'CaptainKaito'");
  await evalExpr("document.querySelector('#home .panel .button-create').click()");
  await new Promise(r => setTimeout(r, 1000));

  const roomCode = await evalExpr("document.getElementById('lobby-code-display').textContent.trim()");
  console.log("Joined lobby:", roomCode);

  const p2 = io('http://localhost:3001', { transports: ["websocket"], path: "/socket.io/" });
  const p3 = io('http://localhost:3001', { transports: ["websocket"], path: "/socket.io/" });
  const p4 = io('http://localhost:3001', { transports: ["websocket"], path: "/socket.io/" });

  await new Promise(r => {
    p2.on('connect', () => p2.emit('login', { join: roomCode, name: 'Ren_Samurai', lang: 'en', avatar: [1, 5, 0, 6] }));
    p2.on('data', pkt => { if (pkt && pkt.id === 10) r(); });
  });

  await new Promise(r => {
    p3.on('connect', () => p3.emit('login', { join: roomCode, name: 'Sakura_Idol', lang: 'en', avatar: [9, 1, 2, 2] }));
    p3.on('data', pkt => { if (pkt && pkt.id === 10) r(); });
  });

  await new Promise(r => {
    p4.on('connect', () => p4.emit('login', { join: roomCode, name: 'Valeria_Hime', lang: 'en', avatar: [21, 0, 7, 15] }));
    p4.on('data', pkt => { if (pkt && pkt.id === 10) r(); });
  });

  await new Promise(r => setTimeout(r, 1000));

  const shotLobby = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'anime_avatar_lobby_players.png'), Buffer.from(shotLobby.data, 'base64'));
  console.log("✓ Captured anime_avatar_lobby_players.png");

  // Click start game
  await evalExpr("document.getElementById('button-start-game').click()");
  await new Promise(r => setTimeout(r, 3500));

  // If word choice modal appears, select word
  await evalExpr("if (document.querySelector('#game-canvas .overlay-content .words .word')) document.querySelector('#game-canvas .overlay-content .words .word').click();");
  await new Promise(r => setTimeout(r, 2000));

  const shotGame = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'anime_avatar_active_gameplay.png'), Buffer.from(shotGame.data, 'base64'));
  console.log("✓ Captured anime_avatar_active_gameplay.png");

  p2.disconnect();
  p3.disconnect();
  p4.disconnect();
  ws.close();
  chrome.kill();
  console.log("Finished successfully!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
