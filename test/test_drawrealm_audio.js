/**
 * DrawRealm — Audio System Automated Test Suite
 * Tests procedural Web Audio API sound engine, sound catalog (all 28 sounds),
 * volume/mute enforcement, voice concurrency limiter & stealing,
 * event deduplication, micro-pitch jitter, and codebase integration.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

console.log("==================================================");
console.log("   DRAWREALM AUDIO ENGINE TEST SUITE");
console.log("==================================================");

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log("  ✓ " + name);
    passedTests++;
  } catch (err) {
    console.error("  ✗ " + name);
    console.error("    Error: " + err.message);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. Mock Web Audio API Environment
// -----------------------------------------------------------------------------
class MockAudioParam {
  constructor(initial = 0) {
    this.value = initial;
    this.events = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: "set", val, time });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: "linear", val, time });
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: "exp", val, time });
  }
}

class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.gain = new MockAudioParam(1);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = "sine";
    this.frequency = new MockAudioParam(440);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
    context.createdOscillators.push(this);
  }
  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }
  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = "lowpass";
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.threshold = new MockAudioParam(-12);
    this.knee = new MockAudioParam(10);
    this.ratio = new MockAudioParam(8);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.15);
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = new MockAudioNode(this);
    this.createdOscillators = [];
  }
  createGain() {
    return new MockGainNode(this);
  }
  createOscillator() {
    return new MockOscillatorNode(this);
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode(this);
  }
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode(this);
  }
  createBufferSource() {
    return new MockAudioNode(this);
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}

// -----------------------------------------------------------------------------
// Helper to instantiate DrawRealmAudio in sandboxed environment
// -----------------------------------------------------------------------------
function createAudioInstance() {
  const mockContext = new MockAudioContext();
  const sandbox = {
    AudioContext: function () { return mockContext; },
    webkitAudioContext: function () { return mockContext; },
    window: {
      AudioContext: function() { return mockContext; },
      webkitAudioContext: function() { return mockContext; },
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    console: console,
    performance: {
      now: () => Date.now()
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id)
  };

  const code = fs.readFileSync(path.join(__dirname, "../js/audio.js"), "utf8");
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    audio: sandbox.window.DrawRealmAudio || sandbox.DrawRealmAudio,
    mockContext
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

console.log("\n1. Initialization & Dynamics Compressor Setup:");
it("Initializes Web Audio graph with Dynamics Compressor limiter and Master Gain", () => {
  const { audio, mockContext } = createAudioInstance();
  audio.init();

  assert.strictEqual(audio.initialized, true, "DrawRealmAudio must be marked initialized");
  assert.ok(audio.compressor, "Compressor node must be instantiated");
  assert.ok(audio.masterGain, "Master gain node must be instantiated");
  assert.strictEqual(audio.compressor.threshold.value, -12, "Compressor threshold should be -12dB");
  assert.strictEqual(audio.compressor.ratio.value, 8, "Compressor ratio should be 8");
  assert.strictEqual(audio.compressor.attack.value, 0.003, "Compressor attack should be 3ms");
  assert.strictEqual(audio.compressor.release.value, 0.15, "Compressor release should be 150ms");
  assert.ok(audio.compressor.connections.includes(audio.masterGain), "Compressor must route to masterGain");
  assert.ok(audio.masterGain.connections.includes(mockContext.destination), "masterGain must route to destination");
});

console.log("\n2. Sound Catalog Completeness (All 28 Sounds):");
const expectedGameplaySounds = [
  "join",
  "leave",
  "game_starting",
  "tick",
  "tick_final",
  "round_start",
  "drawing_starts",
  "correct_guess",
  "fast_correct_guess",
  "wrong_guess",
  "round_end_success",
  "round_end_failure",
  "round_winner",
  "match_victory",
  "match_defeat",
  "button_click",
  "room_created",
  "player_ready"
];

const expectedEvolutionSounds = [
  "power_unlocked",
  "power_choice_appears",
  "power_selected",
  "power_activated",
  "power_cooldown",
  "power_ready_again",
  "ultimate_available",
  "ultimate_activated",
  "level_up",
  "evolution_level_reached"
];

it("Contains all 18 gameplay procedural sound synthesizers", () => {
  const { audio } = createAudioInstance();
  const catalog = audio.catalog;
  expectedGameplaySounds.forEach((snd) => {
    assert.strictEqual(typeof catalog[snd], "function", "Missing gameplay sound: " + snd);
  });
});

it("Contains all 10 Evolution mode procedural sound synthesizers", () => {
  const { audio } = createAudioInstance();
  const catalog = audio.catalog;
  expectedEvolutionSounds.forEach((snd) => {
    assert.strictEqual(typeof catalog[snd], "function", "Missing evolution sound: " + snd);
  });
});

it("Successfully plays every one of the 28 sounds without exceptions", () => {
  const { audio, mockContext } = createAudioInstance();
  audio.init();

  const allSounds = [...expectedGameplaySounds, ...expectedEvolutionSounds];
  assert.strictEqual(allSounds.length, 28, "Total sounds in catalog should be exactly 28");

  allSounds.forEach((snd) => {
    const oscCountBefore = mockContext.createdOscillators.length;
    audio.lastPlayedMap.clear();
    audio.activeVoices.clear();
    audio.play(snd);
    const oscCountAfter = mockContext.createdOscillators.length;
    assert.ok(
      oscCountAfter > oscCountBefore,
      "Sound " + snd + " did not instantiate any oscillators"
    );
  });
});

console.log("\n3. Volume & Mute Enforcement:");
it("Strictly produces 0 oscillators when master volume is set to 0", () => {
  const { audio, mockContext } = createAudioInstance();
  audio.init();
  audio.setVolume(0);

  assert.strictEqual(audio.volume, 0, "Volume should be 0");
  assert.strictEqual(audio.isMuted, true, "isMuted should be true when volume is 0");

  const oscCountBefore = mockContext.createdOscillators.length;
  audio.play("correct_guess");
  audio.play("button_click");
  audio.playSound(0);
  const oscCountAfter = mockContext.createdOscillators.length;

  assert.strictEqual(oscCountAfter, oscCountBefore, "ZERO oscillators must be instantiated when volume is 0");
});

it("Strictly produces 0 oscillators when muted via toggleMute()", () => {
  const { audio, mockContext } = createAudioInstance();
  audio.init();
  audio.setVolume(80);
  assert.strictEqual(audio.isMuted, false);

  const mutedState = audio.toggleMute();
  assert.strictEqual(mutedState, true, "toggleMute must return true when muted");
  assert.strictEqual(audio.volume, 0, "Volume should drop to 0 on mute");

  const oscCountBefore = mockContext.createdOscillators.length;
  audio.play("match_victory");
  const oscCountAfter = mockContext.createdOscillators.length;
  assert.strictEqual(oscCountAfter, oscCountBefore, "ZERO oscillators must be instantiated when muted");

  // Unmute should restore previous volume
  const unmutedState = audio.toggleMute();
  assert.strictEqual(unmutedState, false, "toggleMute must return false when unmuted");
  assert.strictEqual(audio.volume, 80, "Unmute should restore volume to 80");
});

console.log("\n4. Concurrency Management & Voice Stealing:");
it("Limits maximum concurrent voices to 8 and voice steals oldest voice", () => {
  const { audio } = createAudioInstance();
  audio.init();

  let stoppedCount = 0;
  for (let i = 0; i < 8; i++) {
    audio.registerVoice(() => {
      stoppedCount++;
    });
  }

  assert.strictEqual(audio.activeVoices.size, 8, "Must hold 8 active voices");

  audio.lastPlayedMap.clear();
  audio.play("match_victory");

  assert.strictEqual(stoppedCount, 1, "Oldest voice must be stopped (stolen)");
  assert.ok(audio.activeVoices.size <= 8, "Voice count must never exceed max concurrent voices");
});

console.log("\n5. Deduplication & Throttling:");
it("Deduplicates identical sounds triggered within 50ms", () => {
  const { audio, mockContext } = createAudioInstance();
  audio.init();

  const oscCountBefore = mockContext.createdOscillators.length;
  audio.play("button_click");
  const oscCountAfterFirst = mockContext.createdOscillators.length;
  assert.ok(oscCountAfterFirst > oscCountBefore, "First sound must play");

  audio.play("button_click");
  const oscCountAfterSecond = mockContext.createdOscillators.length;
  assert.strictEqual(oscCountAfterSecond, oscCountAfterFirst, "Second immediate sound must be throttled");
});

console.log("\n6. Micro-Pitch Variation (Pitch Jitter):");
it("Randomizes pitch within +/- 1.5% to eliminate repetitive acoustic fatigue", () => {
  const { audio } = createAudioInstance();
  const baseFreq = 1000;
  const samples = [];
  for (let i = 0; i < 50; i++) {
    const j = audio.pitchJitter(baseFreq, 0.015);
    samples.push(j);
    assert.ok(j >= baseFreq * 0.985 - 0.001, "Jitter frequency must be >= -1.5%");
    assert.ok(j <= baseFreq * 1.015 + 0.001, "Jitter frequency must be <= +1.5%");
  }

  const uniqueSamples = new Set(samples.map((s) => s.toFixed(4)));
  assert.ok(uniqueSamples.size > 10, "Pitch jitter must produce variable frequencies");
});

console.log("\n7. Legacy Compatibility (playSound 0-6):");
it("Maps legacy integer IDs (0 to 6) to corresponding audio catalog sounds", () => {
  const { audio, mockContext } = createAudioInstance();
  audio.init();

  for (let id = 0; id <= 6; id++) {
    audio.lastPlayedMap.clear();
    const before = mockContext.createdOscillators.length;
    audio.playSound(id);
    const after = mockContext.createdOscillators.length;
    assert.ok(after > before, "Legacy sound id " + id + " must trigger playback");
  }
});

console.log("\n8. HTML & Codebase Integration Verification:");
it("index.html loads js/audio.js before evolution.js and game.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const audioIdx = html.indexOf("src=\"js/audio.js\"");
  const evoIdx = html.indexOf("src=\"js/evolution.js\"");
  const gameIdx = html.indexOf("src=\"js/game.js\"");

  assert.ok(audioIdx !== -1, "js/audio.js must be in index.html");
  assert.ok(evoIdx !== -1, "js/evolution.js must be in index.html");
  assert.ok(gameIdx !== -1, "js/game.js must be in index.html");
  assert.ok(audioIdx < evoIdx, "js/audio.js must load before js/evolution.js");
  assert.ok(audioIdx < gameIdx, "js/audio.js must load before js/game.js");
});

it("js/evolution.js invokes DrawRealmAudio for power & level events", () => {
  const evo = fs.readFileSync(path.join(__dirname, "../js/evolution.js"), "utf8");
  expectedEvolutionSounds.forEach((snd) => {
    assert.ok(
      evo.includes("\"" + snd + "\"") || evo.includes("'" + snd + "'"),
      "js/evolution.js should trigger sound cue " + snd
    );
  });
});

it("js/game.js hooks all key gameplay sounds and mute toggle", () => {
  const game = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
  assert.ok(game.includes("\"fast_correct_guess\""), "game.js must hook fast_correct_guess");
  assert.ok(game.includes("\"correct_guess\""), "game.js must hook correct_guess");
  assert.ok(game.includes("\"wrong_guess\""), "game.js must hook wrong_guess");
  assert.ok(game.includes("\"button_click\""), "game.js must hook button_click");
  assert.ok(game.includes("\"round_start\""), "game.js must hook round_start");
  assert.ok(game.includes("\"game_starting\""), "game.js must hook game_starting");
  assert.ok(game.includes("\"tick_final\""), "game.js must hook tick_final");
  assert.ok(game.includes("\"round_end_failure\""), "game.js must hook round_end_failure");
  assert.ok(game.includes("\"round_end_success\""), "game.js must hook round_end_success");
  assert.ok(game.includes("\"drawing_starts\""), "game.js must hook drawing_starts");
  assert.ok(game.includes("\"match_victory\""), "game.js must hook match_victory");
  assert.ok(game.includes("\"match_defeat\""), "game.js must hook match_defeat");
  assert.ok(game.includes("toggleMute"), "game.js must hook toggleMute on volume icon");
});

console.log("\n==================================================");
console.log("TEST SUMMARY: " + passedTests + "/" + totalTests + " tests passed.");
console.log("==================================================");

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
