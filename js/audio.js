/**
 * DrawRealm — Studio Game SFX & Audio Engine
 * High-performance Web Audio API synthesis with dynamics compression,
 * voice concurrency management, event deduplication, and micro-variations.
 */

(function (root) {
  "use strict";

  // Audio configuration & limits
  const MAX_CONCURRENT_VOICES = 8;
  const DEDUPLICATION_INTERVAL_MS = 50;

  // Sound priorities: higher priority sounds preempt lower ones during heavy voice load
  const PRIORITY = {
    LOW: 1,      // clicks, ticks
    MEDIUM: 2,   // ordinary gameplay cues, chat feedback
    HIGH: 3,     // correct guess, level up, power activation
    CRITICAL: 4  // match victory, ultimate activation
  };

  class DrawRealmAudio {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.compressor = null;
      this.volume = 100; // 0 - 100
      this.isMuted = false;
      this.previousVolume = 100;

      this.activeVoices = new Set();
      this.lastPlayedMap = new Map(); // soundName -> timestamp
      this.initialized = false;

      // Legacy numeric IDs mapping to sound names for 100% backwards compatibility
      this.legacyMap = {
        0: "drawing_starts",     // Sn (roundStart.ogg)
        1: "round_end_success",  // kn (roundEndSuccess.ogg)
        2: "round_end_failure",  // wn (roundEndFailure.ogg)
        3: "join",               // Cn (join.ogg)
        4: "leave",              // qn (leave.ogg)
        5: "correct_guess",      // xn (playerGuessed.ogg)
        6: "tick"                // Mn (tick.ogg)
      };

      // Auto-unlock on first user interaction
      this.bindUnlockListeners();
    }

    /**
     * Initializes the Web Audio Context and master limiter graph.
     */
    init() {
      if (this.initialized && this.ctx) {
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        return;
      }

      try {
        const AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) {
          return;
        }

        this.ctx = new AudioContextClass();

        // 1. Master Dynamics Compressor (Limiter)
        // Mathematically prevents clipping, harsh volume spikes, and distortion
        this.compressor = this.ctx.createDynamicsCompressor();
        if (this.compressor.threshold) this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime); // dB
        if (this.compressor.knee) this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
        if (this.compressor.ratio) this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
        if (this.compressor.attack) this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime); // 3ms fast attack
        if (this.compressor.release) this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime); // 150ms release

        // 2. Master Gain Node
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume / 100, this.ctx.currentTime);

        // Connect graph: Compressor -> Master Gain -> Destination
        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;
      } catch (err) {
        console.warn("[DrawRealm Audio] Failed to initialize AudioContext:", err);
      }
    }

    /**
     * Binds user interaction listeners to safely unlock AudioContext per browser autoplay policies.
     */
    bindUnlockListeners() {
      if (typeof window === "undefined" || !window.addEventListener) return;

      const unlock = () => {
        if (!this.ctx) {
          this.init();
        } else if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
        window.removeEventListener("touchstart", unlock, true);
      };

      window.addEventListener("pointerdown", unlock, { once: true, capture: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true, capture: true, passive: true });
      window.addEventListener("touchstart", unlock, { once: true, capture: true, passive: true });
    }

    /**
     * Sets master volume (0 - 100).
     */
    setVolume(val) {
      val = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
      this.volume = val;
      if (val > 0) {
        this.isMuted = false;
        this.previousVolume = val;
      } else {
        this.isMuted = true;
      }

      if (this.masterGain && this.ctx) {
        const targetGain = this.isMuted ? 0 : this.volume / 100;
        this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      }
    }

    /**
     * Toggles mute state.
     */
    toggleMute() {
      if (this.isMuted || this.volume === 0) {
        this.setVolume(this.previousVolume > 0 ? this.previousVolume : 80);
      } else {
        this.previousVolume = this.volume;
        this.setVolume(0);
      }
      return this.isMuted;
    }

    /**
     * Deduplication check to prevent double-firing from socket re-transmissions.
     */
    shouldThrottle(soundName) {
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const last = this.lastPlayedMap.get(soundName) || 0;
      if (now - last < DEDUPLICATION_INTERVAL_MS) {
        return true;
      }
      this.lastPlayedMap.set(soundName, now);
      return false;
    }

    /**
     * Legacy playSound adapter for compatibility with original game.js calls.
     */
    playSound(id) {
      const name = this.legacyMap[id];
      if (name) {
        this.play(name);
      }
    }

    /**
     * Main dispatch method for playing any sound in the catalog.
     */
    play(soundName, options = {}) {
      if (this.isMuted || this.volume <= 0) return;

      if (this.shouldThrottle(soundName)) return;

      if (!this.initialized || !this.ctx) {
        this.init();
      }

      if (!this.ctx) return;

      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }

      // Concurrency check
      if (this.activeVoices.size >= MAX_CONCURRENT_VOICES) {
        const soundPriority = options.priority || this.getSoundPriority(soundName);
        if (soundPriority <= PRIORITY.LOW) {
          // Drop low priority sound during voice congestion
          return;
        }
        // Voice steal: remove oldest voice if needed
        const oldestVoice = this.activeVoices.values().next().value;
        if (oldestVoice && typeof oldestVoice.stop === "function") {
          try { oldestVoice.stop(); } catch (e) {}
          this.activeVoices.delete(oldestVoice);
        }
      }

      // Execute synthesis definition
      try {
        const synthFn = this.catalog[soundName];
        if (typeof synthFn === "function") {
          synthFn.call(this, options);
        } else {
          console.warn("[DrawRealm Audio] Sound not found:", soundName);
        }
      } catch (err) {
        console.warn("[DrawRealm Audio] Playback error:", err);
      }
    }

    /**
     * Helper to determine sound priority.
     */
    getSoundPriority(name) {
      if (name === "match_victory" || name === "ultimate_activated") return PRIORITY.CRITICAL;
      if (name === "correct_guess" || name === "fast_correct_guess" || name === "level_up" || name === "evolution_level_reached") return PRIORITY.HIGH;
      if (name === "tick" || name === "button_click" || name === "power_cooldown") return PRIORITY.LOW;
      return PRIORITY.MEDIUM;
    }

    /**
     * Helper to track active sound voice.
     */
    registerVoice(cleanupFn) {
      const voiceToken = { stop: cleanupFn };
      this.activeVoices.add(voiceToken);
      return () => {
        this.activeVoices.delete(voiceToken);
        if (cleanupFn) cleanupFn();
      };
    }

    /**
     * Generates slight micro-pitch randomization (+/- 1.5%) to avoid ear fatigue.
     */
    pitchJitter(freq, amount = 0.015) {
      const jitter = 1 + (Math.random() * 2 - 1) * amount;
      return freq * jitter;
    }

    // =========================================================================
    // SOUND CATALOG (Procedural Web Audio API Synthesis)
    // Short, crisp, responsive, subtle, pleasant, low-fatigue.
    // =========================================================================
    get catalog() {
      return {
        // ---------------------------------------------------------------------
        // 1. GAMEPLAY SOUNDS
        // ---------------------------------------------------------------------

        /**
         * Player Join: Welcoming warm two-tone chime (G5 -> C6).
         */
        join: () => {
          const t0 = this.ctx.currentTime;
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(this.pitchJitter(784), t0); // G5
          osc1.frequency.exponentialRampToValueAtTime(1046, t0 + 0.12); // C6

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(this.pitchJitter(784), t0);
          osc2.frequency.exponentialRampToValueAtTime(1046, t0 + 0.12);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.compressor);

          osc1.start(t0);
          osc2.start(t0);
          osc1.stop(t0 + 0.3);
          osc2.stop(t0 + 0.3);

          const unregister = this.registerVoice(() => {
            try { osc1.stop(); osc2.stop(); } catch (e) {}
          });
          setTimeout(unregister, 320);
        },

        /**
         * Player Leave: Gentle, subtle descending departure blip (C5 -> G4).
         */
        leave: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(523, t0); // C5
          osc.frequency.exponentialRampToValueAtTime(392, t0 + 0.18); // G4

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.16, t0 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

          osc.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.24);

          const unregister = this.registerVoice(() => {
            try { osc.stop(); } catch (e) {}
          });
          setTimeout(unregister, 250);
        },

        /**
         * Game Starting: Uplifting ascending anticipation chime triplet (F4 -> A4 -> C5).
         */
        game_starting: () => {
          const t0 = this.ctx.currentTime;
          const notes = [349, 440, 523];
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.09;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.25);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 450);
        },

        /**
         * Countdown Tick: Ultra-subtle wooden/glass micro-tap.
         * Jittered pitch prevents ear fatigue over 80-second drawing rounds.
         */
        tick: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          const baseFreq = this.pitchJitter(940, 0.03);
          osc.type = "sine";
          osc.frequency.setValueAtTime(baseFreq, t0);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, t0 + 0.035);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1100, t0);
          filter.Q.setValueAtTime(2.5, t0);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.09, t0 + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.045);

          const unregister = this.registerVoice();
          setTimeout(unregister, 55);
        },

        /**
         * Final Countdown Tick: Distinct, deeper resonant accent (timer <= 1s or 0).
         */
        tick_final: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(440, t0); // A4
          osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.16); // A3

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.25, t0 + 0.004);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);

          osc.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.2);

          const unregister = this.registerVoice();
          setTimeout(unregister, 220);
        },

        /**
         * Round Starts: Announcement chord for new round (C5 + G5 + C6).
         */
        round_start: () => {
          const t0 = this.ctx.currentTime;
          const freqs = [523, 784, 1046];
          freqs.forEach((freq, i) => {
            const time = t0 + i * 0.04;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.36);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 500);
        },

        /**
         * Drawing Starts: Creative, crisp chime / brush flourish (D5 -> A5 -> E6).
         */
        drawing_starts: () => {
          const t0 = this.ctx.currentTime;
          const freqs = [587, 880, 1318];
          freqs.forEach((freq, idx) => {
            const time = t0 + idx * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.18, time + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.28);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 450);
        },

        /**
         * Correct Guess: Rewarding, crisp positive two-tone chime (E5 -> B5).
         */
        correct_guess: () => {
          const t0 = this.ctx.currentTime;
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(659, t0); // E5
          osc1.frequency.setValueAtTime(987, t0 + 0.1); // B5

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(659 * 2, t0);
          osc2.frequency.setValueAtTime(987 * 2, t0 + 0.1);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.24, t0 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.compressor);

          osc1.start(t0);
          osc2.start(t0);
          osc1.stop(t0 + 0.34);
          osc2.stop(t0 + 0.34);

          const unregister = this.registerVoice();
          setTimeout(unregister, 360);
        },

        /**
         * Fast Correct Guess: Sparkling positive variation with ascending major flourish.
         */
        fast_correct_guess: () => {
          const t0 = this.ctx.currentTime;
          const notes = [659, 830, 987, 1318]; // E5, G#5, B5, E6
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.22, time + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.35);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 550);
        },

        /**
         * Wrong Guess: Discrete, subtle muted low wooden knock (180Hz -> 120Hz).
         * Gentle and polite, NOT a loud/harsh buzzer.
         */
        wrong_guess: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(180, t0);
          osc.frequency.exponentialRampToValueAtTime(115, t0 + 0.07);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(320, t0);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.14, t0 + 0.003);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.09);

          const unregister = this.registerVoice();
          setTimeout(unregister, 100);
        },

        /**
         * Round End Success: Word was solved, turn concludes positively.
         */
        round_end_success: () => {
          const t0 = this.ctx.currentTime;
          const notes = [392, 523, 659, 784]; // G4, C5, E5, G5
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.44);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 650);
        },

        /**
         * Round End Failure: Nobody guessed, time ran out. Gentle descending resolution.
         */
        round_end_failure: () => {
          const t0 = this.ctx.currentTime;
          const notes = [392, 349, 311]; // G4, F4, Eb4
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.09;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.16, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.34);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 550);
        },

        /**
         * Round Winner: Cheerful celebratory progression.
         */
        round_winner: () => {
          const t0 = this.ctx.currentTime;
          const notes = [523, 659, 784, 1046]; // C5, E5, G5, C6
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.48);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.5);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 700);
        },

        /**
         * Match Victory: Triumphant, studio-grade celebratory fanfare for 1st place!
         */
        match_victory: () => {
          const t0 = this.ctx.currentTime;
          // Arpeggiated victory chord sequence: C major -> G major -> high C triumph
          const chords = [
            { time: 0.00, notes: [523, 659, 784] },  // C5, E5, G5
            { time: 0.22, notes: [587, 784, 880] },  // D5, G5, A5
            { time: 0.44, notes: [659, 784, 1046] }, // E5, G5, C6
            { time: 0.72, notes: [1046, 1318, 1568] } // C6, E6, G6
          ];

          chords.forEach(chord => {
            chord.notes.forEach(freq => {
              const start = t0 + chord.time;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();

              osc.type = "triangle";
              osc.frequency.setValueAtTime(freq, start);

              gain.gain.setValueAtTime(0.001, start);
              gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
              gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

              osc.connect(gain);
              gain.connect(this.compressor);

              osc.start(start);
              osc.stop(start + 0.48);
            });
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 1300);
        },

        /**
         * Match Defeat / Conclusion: Gentle, peaceful acoustic completion chord.
         */
        match_defeat: () => {
          const t0 = this.ctx.currentTime;
          const notes = [349, 440, 523, 659]; // F4, A4, C5, E5
          notes.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, t0);

            gain.gain.setValueAtTime(0.001, t0);
            gain.gain.linearRampToValueAtTime(0.15, t0 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(t0);
            osc.stop(t0 + 0.6);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 650);
        },

        /**
         * Button Click: Tactile, modern, ultra-crisp UI micro-tap (22ms).
         */
        button_click: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          const baseFreq = this.pitchJitter(1350, 0.03);
          osc.type = "sine";
          osc.frequency.setValueAtTime(baseFreq, t0);
          osc.frequency.exponentialRampToValueAtTime(800, t0 + 0.02);

          filter.type = "bandpass";
          filter.frequency.setValueAtTime(1200, t0);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.12, t0 + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.025);

          const unregister = this.registerVoice();
          setTimeout(unregister, 35);
        },

        /**
         * Room Created: Fresh, bright, welcoming room initialized tone.
         */
        room_created: () => {
          const t0 = this.ctx.currentTime;
          const freqs = [523, 784, 1046];
          freqs.forEach((freq, idx) => {
            const time = t0 + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.18, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.3);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 450);
        },

        /**
         * Player Ready: Snappy, crisp ready confirmation pop.
         */
        player_ready: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(698, t0); // F5
          osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.08); // A5

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.2, t0 + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

          osc.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.13);

          const unregister = this.registerVoice();
          setTimeout(unregister, 150);
        },

        // ---------------------------------------------------------------------
        // 2. EVOLUTION MODE SOUNDS
        // ---------------------------------------------------------------------

        /**
         * Power Unlocked: Magical ascending crystalline shimmer with resonance.
         */
        power_unlocked: () => {
          const t0 = this.ctx.currentTime;
          const notes = [784, 1046, 1318, 1568]; // G5, C6, E6, G6
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.22, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.4);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 600);
        },

        /**
         * Power Choice Appears: Mysterious ethereal harmonic reveal swell.
         */
        power_choice_appears: () => {
          const t0 = this.ctx.currentTime;
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc1.type = "sawtooth";
          osc1.frequency.setValueAtTime(261.63, t0); // C4

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(392.0, t0); // G4

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(300, t0);
          filter.frequency.exponentialRampToValueAtTime(1800, t0 + 0.2);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.18, t0 + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);

          osc1.start(t0);
          osc2.start(t0);
          osc1.stop(t0 + 0.35);
          osc2.stop(t0 + 0.35);

          const unregister = this.registerVoice();
          setTimeout(unregister, 400);
        },

        /**
         * Power Selected: Snappy, satisfying card lock-in confirm.
         */
        power_selected: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(440, t0); // A4
          osc.frequency.setValueAtTime(880, t0 + 0.05); // A5

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.24, t0 + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

          osc.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.18);

          const unregister = this.registerVoice();
          setTimeout(unregister, 200);
        },

        /**
         * Power Activated: Energetic fantasy power unleash (punchy sweep + harmonic ping).
         */
        power_activated: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(260, t0);
          osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.08);
          osc.frequency.exponentialRampToValueAtTime(440, t0 + 0.22);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.25, t0 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);

          osc.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.28);

          const unregister = this.registerVoice();
          setTimeout(unregister, 300);
        },

        /**
         * Power Cooldown Feedback: Discrete low muted tap indicating on cooldown.
         */
        power_cooldown: () => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(260, t0);
          osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.04);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(400, t0);

          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.linearRampToValueAtTime(0.12, t0 + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.compressor);

          osc.start(t0);
          osc.stop(t0 + 0.05);

          const unregister = this.registerVoice();
          setTimeout(unregister, 60);
        },

        /**
         * Power Ready Again: Short crisp double-chime notification when cooldown ends.
         */
        power_ready_again: () => {
          const t0 = this.ctx.currentTime;
          const notes = [1318, 1661]; // E6, G#6
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.16, time + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.17);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 250);
        },

        /**
         * Ultimate Available: Radiant energy charge / power hum notification.
         */
        ultimate_available: () => {
          const t0 = this.ctx.currentTime;
          const freqs = [146.83, 293.66, 440.0, 739.99]; // D3, D4, A4, F#5
          freqs.forEach((freq, idx) => {
            const time = t0 + idx * 0.04;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = idx === 0 ? "sawtooth" : "sine";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.58);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 650);
        },

        /**
         * Ultimate Activated: High-impact cinematic cue (controlled sub-bass swell + energy sweep).
         * Master limiter prevents clipping while delivering immense impact.
         */
        ultimate_activated: () => {
          const t0 = this.ctx.currentTime;

          // 1. Sub Bass Punch
          const subOsc = this.ctx.createOscillator();
          const subGain = this.ctx.createGain();
          subOsc.type = "sine";
          subOsc.frequency.setValueAtTime(110, t0);
          subOsc.frequency.exponentialRampToValueAtTime(45, t0 + 0.28);

          subGain.gain.setValueAtTime(0.001, t0);
          subGain.gain.linearRampToValueAtTime(0.35, t0 + 0.015);
          subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);

          subOsc.connect(subGain);
          subGain.connect(this.compressor);

          // 2. High Energy Resonance Sweep
          const sweepOsc = this.ctx.createOscillator();
          const sweepFilter = this.ctx.createBiquadFilter();
          const sweepGain = this.ctx.createGain();

          sweepOsc.type = "sawtooth";
          sweepOsc.frequency.setValueAtTime(300, t0);
          sweepOsc.frequency.exponentialRampToValueAtTime(1400, t0 + 0.25);

          sweepFilter.type = "bandpass";
          sweepFilter.frequency.setValueAtTime(600, t0);
          sweepFilter.frequency.exponentialRampToValueAtTime(2200, t0 + 0.25);
          sweepFilter.Q.setValueAtTime(3.0, t0);

          sweepGain.gain.setValueAtTime(0.001, t0);
          sweepGain.gain.linearRampToValueAtTime(0.22, t0 + 0.05);
          sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);

          sweepOsc.connect(sweepFilter);
          sweepFilter.connect(sweepGain);
          sweepGain.connect(this.compressor);

          subOsc.start(t0);
          subOsc.stop(t0 + 0.48);
          sweepOsc.start(t0);
          sweepOsc.stop(t0 + 0.6);

          const unregister = this.registerVoice(() => {
            try { subOsc.stop(); sweepOsc.stop(); } catch (e) {}
          });
          setTimeout(unregister, 700);
        },

        /**
         * Level Up: Uplifting multi-harmonic progression chime.
         */
        level_up: () => {
          const t0 = this.ctx.currentTime;
          const notes = [523, 659, 784, 987, 1046]; // C5, E5, G5, B5, C6
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.22, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);

            osc.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.47);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 650);
        },

        /**
         * Evolution Level Reached: Majestic milestone fanfare.
         */
        evolution_level_reached: () => {
          const t0 = this.ctx.currentTime;
          const notes = [311.13, 466.16, 622.25, 783.99]; // Eb4, Bb4, Eb5, G5
          notes.forEach((freq, idx) => {
            const time = t0 + idx * 0.05;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, time);

            const filter = this.ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(1600, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.72);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.compressor);

            osc.start(time);
            osc.stop(time + 0.75);
          });

          const unregister = this.registerVoice();
          setTimeout(unregister, 850);
        }
      };
    }
  }

  // Create singleton instance and export
  const drawRealmAudio = new DrawRealmAudio();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DrawRealmAudio, drawRealmAudio };
  }

  if (typeof window !== "undefined") {
    window.DrawRealmAudio = drawRealmAudio;
    window.soundManager = drawRealmAudio;
  }
})(typeof window !== "undefined" ? window : globalThis);
