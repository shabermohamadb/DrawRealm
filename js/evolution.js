/**
 * Evolution Mode — Client Controller
 * Pure modular integration with original skribbl.io UI
 */

(function () {
  let socket = null;
  let evolutionState = null;
  let cooldownInterval = null;
  let isEvolutionActive = false;

  // Intercept window.io to capture socket instance cleanly and ensure production path
  if (window.io) {
    const origIo = window.io;
    window.io = function (uri, opts = {}) {
      opts = opts || {};
      opts.path = "/socket.io/";
      if (!opts.transports) {
        opts.transports = ["websocket", "polling"];
      }
      if (typeof uri === "string") {
        if (location.protocol === "https:" && uri.startsWith("http://")) {
          uri = uri.replace(/^http:\/\//, "https://");
        }
      } else if (!uri) {
        uri = location.origin;
      }
      console.log("[DrawRealm Client] Connecting socket to:", uri, "path:", opts.path);
      const sock = origIo.call(this, uri, opts);
      socket = sock;
      window.__skribblSocket = sock;
      attachSocketListeners(sock);
      return sock;
    };
    Object.assign(window.io, origIo);
  }

  function appendSystemChatMessage(msgText, color) {
    if (!msgText) return;
    const chatContent = document.querySelector("#game-chat .chat-content");
    if (!chatContent) return;
    const p = document.createElement("p");
    p.className = "evolution-system-chat";
    p.style.color = color || "#ffb703";
    p.style.fontWeight = "bold";
    p.style.margin = "2px 0";
    p.style.fontSize = "13px";
    p.textContent = msgText;
    chatContent.appendChild(p);
    chatContent.scrollTop = chatContent.scrollHeight;
  }

  function attachSocketListeners(sock) {
    sock.on("connect", () => {
      console.log("[DrawRealm Client] Socket connected successfully! ID:", sock.id);
    });
    sock.on("connect_error", (err) => {
      console.error("[DrawRealm Client] Socket connect_error:", err.message);
    });
    sock.on("disconnect", (reason) => {
      console.warn("[DrawRealm Client] Socket disconnected:", reason);
    });

    // Intercept emit to automatically inject reconnectToken and pending room options into login
    const origEmit = sock.emit.bind(sock);
    sock.emit = function (evt, ...args) {
      if (evt === "login" && args[0] && typeof args[0] === "object") {
        try {
          const raw = sessionStorage.getItem("drawrealm_session");
          if (raw) {
            const sess = JSON.parse(raw);
            if (sess && sess.token) {
              args[0].reconnectToken = sess.token;
            }
          }
          if (window.__drawrealmPendingRoom && args[0].create === 1) {
            Object.assign(args[0], window.__drawrealmPendingRoom);
            window.__drawrealmPendingRoom = null;
          }
        } catch (e) {}
      }
      return origEmit(evt, ...args);
    };

    const origOn = sock.on.bind(sock);
    sock.on = function (evt, fn) {
      if (evt === "data") {
        const safeDataHandler = function (packet) {
          if (packet && packet.id === 30 && packet.data && (!packet.data.id || packet.data.id === 0)) {
            appendSystemChatMessage(packet.data.msg);
            return;
          }
          return fn(packet);
        };
        return origOn(evt, safeDataHandler);
      }
      return origOn(evt, fn);
    };

    sock.on("drawrealm:session", (sessionData) => {
      if (sessionData && sessionData.token) {
        try {
          sessionStorage.setItem("drawrealm_session", JSON.stringify(sessionData));
        } catch (e) {}
      }
    });

    sock.on("drawrealm:server_shutdown", (data) => {
      if (data && data.message) {
        appendSystemChatMessage(data.message, "#e63946");
      }
    });

    sock.on("evolution:state", onEvolutionState);
    sock.on("evolution:xp_gain", onXpGain);
    sock.on("evolution:effect", onEvolutionEffect);
    sock.on("evolution:roster", onEvolutionRoster);
    sock.on("evolution:letter_vision", onLetterVision);
    sock.on("evolution:word_scan", onWordScan);
    sock.on("evolution:pattern_sense", onPatternSense);
    sock.on("evolution:color_burst", onColorBurst);
    sock.on("evolution:perfect_line", onPerfectLine);
    sock.on("evolution:announcement", (data) => {
      if (data && data.msg) appendSystemChatMessage(data.msg, data.color);
    });

    // Watch for legacy packet 10 (ROOM_INIT) and 12 (SETTINGS)
    sock.on("data", (packet = {}) => {
      if (packet.id === 10) {
        if (packet.data && packet.data.reconnectToken) {
          try {
            sessionStorage.setItem("drawrealm_session", JSON.stringify({
              token: packet.data.reconnectToken,
              roomId: packet.data.id,
              playerId: packet.data.me
            }));
          } catch (e) {}
        }
        if (packet.data && packet.data.settings) {
          checkModeActive(packet.data.settings[6]);
        }
        setTimeout(updateLobbyHeader, 50);
      } else if (packet.id === 12) {
        if (packet.data && parseInt(packet.data.id, 10) === 6) {
          checkModeActive(packet.data.val);
        }
        setTimeout(updateLobbyHeader, 50);
      }
    });
  }

  function checkModeActive(modeValue) {
    isEvolutionActive = parseInt(modeValue) === 6;
    const dock = document.getElementById("evolution-dock");
    if (dock) {
      dock.style.display = isEvolutionActive ? "flex" : "none";
    }
    const draftModal = document.getElementById("overlay-evolution-choice");
    if (draftModal && !isEvolutionActive) {
      draftModal.style.display = "none";
    }
    updateLobbyHeader();
  }

  function onEvolutionState(state) {
    evolutionState = state;
    isEvolutionActive = !!state.isEvolutionMode;

    const dock = document.getElementById("evolution-dock");
    if (!dock) return;

    dock.style.display = isEvolutionActive ? "flex" : "none";
    if (!isEvolutionActive) return;

    // 1. Update Level & XP Badge
    const lvlText = dock.querySelector(".evolution-badge-level");
    if (lvlText) {
      lvlText.textContent = `LEVEL ${state.level} - ${state.title.toUpperCase()}`;
    }

    const xpFill = dock.querySelector(".evolution-xp-bar-fill");
    const xpText = dock.querySelector(".evolution-badge-xp");
    const curLevelBase = state.currentLevelXp || 0;
    const nextLevelTarget = state.nextLevelXp || 100;
    const xpInLevel = Math.max(0, state.xp - curLevelBase);
    const xpNeededInLevel = Math.max(1, nextLevelTarget - curLevelBase);
    const pct = Math.min(100, Math.round((xpInLevel / xpNeededInLevel) * 100));

    if (xpFill) xpFill.style.width = `${pct}%`;
    if (xpText) xpText.textContent = `${state.xp} / ${nextLevelTarget} XP`;

    // 2. Update Streak
    const streakEl = dock.querySelector(".evolution-badge-streak");
    if (streakEl) {
      if (state.streak >= 2) {
        streakEl.style.display = "inline-block";
        streakEl.textContent = `Streak: ${state.streak}`;
      } else {
        streakEl.style.display = "none";
      }
    }

    // 3. Render Normal Power Slots (Slots 0, 1, 2)
    const normalSlots = dock.querySelectorAll(".evolution-slot:not(.evolution-slot-ultimate)");
    normalSlots.forEach((slotEl, idx) => {
      const btn = slotEl.querySelector(".evolution-power-btn");
      const power = state.equippedPowers[idx] || null;
      renderPowerButton(btn, power, idx + 1, state.cooldowns);
    });

    // 4. Render Ultimate Slot (Slot 3)
    const ultSlot = dock.querySelector(".evolution-slot-ultimate");
    if (ultSlot) {
      const btn = ultSlot.querySelector(".evolution-power-btn");
      renderPowerButton(btn, state.ultimatePower, 4, state.cooldowns, true);
    }

    // 5. Check Pending Draft
    renderDraftModal(state.pendingDraft);

    // 6. Start / Refresh Cooldown Countdown Timer
    startCooldownTicker();
  }

  function renderPowerButton(btn, power, keyNum, cooldowns, isUlt = false) {
    if (!btn) return;
    const overlay = btn.querySelector(".cooldown-overlay");
    const iconEl = btn.querySelector(".power-icon");
    const nameEl = btn.querySelector(".power-name");

    if (!power) {
      btn.classList.add("empty");
      btn.dataset.powerId = "";
      btn.removeAttribute("data-tooltip");
      if (iconEl) iconEl.textContent = "";
      if (nameEl) nameEl.textContent = isUlt ? "LOCKED" : "EMPTY";
      if (overlay) overlay.style.display = "none";
      return;
    }

    btn.classList.remove("empty");
    btn.dataset.powerId = power.id;
    btn.dataset.tooltip = `${power.name.toUpperCase()} [${power.rarity.toUpperCase()}]\n${power.description}\nHotkey: [${keyNum}]`;
    btn.dataset.tooltipdir = "N";

    if (iconEl) iconEl.textContent = "";
    if (nameEl) nameEl.textContent = power.name;

    const cdSec = (cooldowns && cooldowns[power.id]) || 0;
    if (cdSec > 0) {
      btn.classList.add("on-cooldown");
      if (overlay) {
        overlay.style.display = "flex";
        overlay.textContent = `${cdSec}s`;
      }
    } else {
      btn.classList.remove("on-cooldown");
      if (overlay) overlay.style.display = "none";
    }
  }

  function startCooldownTicker() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      if (!evolutionState || !evolutionState.cooldowns) return;
      let hasActiveCd = false;
      for (const [pId, sec] of Object.entries(evolutionState.cooldowns)) {
        if (sec > 1) {
          evolutionState.cooldowns[pId] = sec - 1;
          hasActiveCd = true;
        } else {
          delete evolutionState.cooldowns[pId];
        }
      }

      // Update cooldown UI overlays
      const buttons = document.querySelectorAll(".evolution-power-btn:not(.empty)");
      buttons.forEach(btn => {
        const pId = btn.dataset.powerId;
        const overlay = btn.querySelector(".cooldown-overlay");
        const remaining = evolutionState.cooldowns[pId] || 0;
        if (remaining > 0) {
          btn.classList.add("on-cooldown");
          if (overlay) {
            overlay.style.display = "flex";
            overlay.textContent = `${remaining}s`;
          }
        } else {
          btn.classList.remove("on-cooldown");
          if (overlay) overlay.style.display = "none";
        }
      });

      if (!hasActiveCd) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    }, 1000);
  }

  function renderDraftModal(draftChoices) {
    let modal = document.getElementById("overlay-evolution-choice");
    if (!modal) return;

    if (!draftChoices || draftChoices.length === 0) {
      modal.style.display = "none";
      return;
    }

    modal.style.display = "flex";
    const container = modal.querySelector(".evolution-draft-choices");
    if (!container) return;

    container.innerHTML = "";
    draftChoices.forEach(choice => {
      const card = document.createElement("div");
      card.className = "evolution-choice-card";
      card.innerHTML = `
        <div class="choice-name">${choice.name.toUpperCase()}</div>
        <div class="choice-rarity" style="color:${getRarityColor(choice.rarity)}">${choice.rarity.toUpperCase()}</div>
        <div class="choice-desc">${choice.description}</div>
      `;
      card.addEventListener("click", () => {
        if (socket) {
          socket.emit("evolution:select_power", choice.id);
        }
        modal.style.display = "none";
      });
      container.appendChild(card);
    });
  }

  function getRarityColor(rarity) {
    switch (rarity) {
      case "UNCOMMON": return "#22c55e";
      case "RARE": return "#3b82f6";
      case "EPIC": return "#a855f7";
      case "LEGENDARY": return "#f59e0b";
      case "ULTIMATE": return "#ef4444";
      default: return "#64748b";
    }
  }

  function activatePowerBySlot(slotNum) {
    if (!isEvolutionActive || !socket) return;
    const dock = document.getElementById("evolution-dock");
    if (!dock) return;

    const btn = dock.querySelector(`.evolution-power-btn[data-key="${slotNum}"]`);
    if (!btn || btn.classList.contains("empty") || btn.classList.contains("on-cooldown")) return;

    const pId = btn.dataset.powerId;
    if (pId) {
      btn.classList.add("clicked");
      setTimeout(() => btn.classList.remove("clicked"), 200);
      socket.emit("evolution:activate_power", pId);
    }
  }

  function onXpGain(data) {
    // Subtle float notification if canvas is present
    const notice = document.createElement("div");
    notice.className = "evolution-xp-toast";
    notice.textContent = `+${data.amount} XP (${data.reason || "Reward"})`;
    const canvasWrap = document.getElementById("game-canvas");
    if (canvasWrap) {
      canvasWrap.appendChild(notice);
      setTimeout(() => notice.remove(), 2200);
    }
  }

  function onEvolutionEffect(data) {
    if (data.type === "reverse_canvas") {
      const cvs = document.querySelector("#game-canvas canvas");
      if (cvs) {
        cvs.style.transform = "scaleX(-1)";
        setTimeout(() => {
          cvs.style.transform = "";
        }, (data.duration || 15) * 1000);
      }
    }
  }

  function onEvolutionRoster(roster) {
    if (!Array.isArray(roster)) return;
    roster.forEach(item => {
      const playerEl = document.querySelector(`.player[data-player-id="${item.id}"]`);
      if (playerEl) {
        let badge = playerEl.querySelector(".player-evo-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "player-evo-badge";
          const nameEl = playerEl.querySelector(".player-name");
          if (nameEl) nameEl.appendChild(badge);
        }
        badge.textContent = `Lv.${item.level}`;
      }
    });
  }

  function onLetterVision(data) {
    const hintsContainer = document.querySelector("#game-word .hints .container");
    if (hintsContainer && hintsContainer.children[data.index]) {
      const hintSpan = hintsContainer.children[data.index];
      hintSpan.textContent = data.letter;
      hintSpan.classList.add("uncover", "evolution-hint");
    }
  }

  function onWordScan(data) {
    console.log(`[Word Scan] Length: ${data.length}, Category: ${data.category}`);
  }

  function onPatternSense(data) {
    console.log(`[Pattern Sense] First: ${data.first}, Last: ${data.last}`);
  }

  function onColorBurst(data) {
    console.log("[Color Burst] Bonus colors available!");
  }

  function onPerfectLine(data) {
    console.log("[Perfect Line] Straight line assist active!");
  }

  // Keyboard shortcut listener for keys 1, 2, 3, 4
  document.addEventListener("keydown", function (e) {
    if (!isEvolutionActive) return;
    const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") return;

    if (e.key === "1") activatePowerBySlot(1);
    else if (e.key === "2") activatePowerBySlot(2);
    else if (e.key === "3") activatePowerBySlot(3);
    else if (e.key === "4") activatePowerBySlot(4);
  });

  // ========================================================
  // DRAWREALM UI & PRE-GAME FLOW CONTROLLER
  // ========================================================
  let hasShownEvolutionIntro = false;

  function openDrawRealmModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = "flex";
  }

  function closeDrawRealmModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = "none";
  }

  function setupDrawRealmModals() {
    // Open Buttons
    const btnCreate = document.getElementById("btn-create-room-open");
    if (btnCreate) {
      btnCreate.addEventListener("click", () => openDrawRealmModal("drawrealm-modal-create"));
    }

    const btnJoin = document.getElementById("btn-join-room-open");
    if (btnJoin) {
      btnJoin.addEventListener("click", () => {
        const err = document.getElementById("join-error-msg");
        if (err) err.style.display = "none";
        openDrawRealmModal("drawrealm-modal-join");
      });
    }

    const btnPublic = document.getElementById("btn-public-rooms-open");
    if (btnPublic) {
      btnPublic.addEventListener("click", () => {
        openDrawRealmModal("drawrealm-modal-public");
        loadPublicRooms();
      });
    }

    const btnRules = document.getElementById("btn-rules-open");
    if (btnRules) {
      btnRules.addEventListener("click", () => openDrawRealmModal("drawrealm-modal-rules"));
    }

    const btnLobbyRules = document.getElementById("btn-lobby-rules");
    if (btnLobbyRules) {
      btnLobbyRules.addEventListener("click", () => openDrawRealmModal("drawrealm-modal-rules"));
    }

    const btnHow = document.getElementById("btn-how-open");
    if (btnHow) {
      btnHow.addEventListener("click", () => openDrawRealmModal("drawrealm-modal-how"));
    }

    const btnSideEvo = document.getElementById("btn-side-evo-guide");
    if (btnSideEvo) {
      btnSideEvo.addEventListener("click", () => openDrawRealmModal("drawrealm-modal-evolution-intro"));
    }

    const btnCreatePublicQuick = document.getElementById("btn-create-public-quick");
    if (btnCreatePublicQuick) {
      btnCreatePublicQuick.addEventListener("click", () => {
        closeDrawRealmModal("drawrealm-modal-public");
        openDrawRealmModal("drawrealm-modal-create");
        document.querySelectorAll("#create-room-type-group .btn-toggle").forEach(b => {
          b.classList.toggle("active", b.dataset.value === "public");
        });
      });
    }

    const btnRefreshPublic = document.getElementById("btn-refresh-public-rooms");
    if (btnRefreshPublic) {
      btnRefreshPublic.addEventListener("click", loadPublicRooms);
    }

    // Close buttons
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.closeModal;
        const modal = document.getElementById(`drawrealm-modal-${target}`);
        if (modal) modal.style.display = "none";
      });
    });

    // Clicking outside modal box closes modal
    document.querySelectorAll(".drawrealm-modal").forEach(modal => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
      });
    });

    // Create Room Toggles
    setupToggleGroup("create-room-type-group");
    setupToggleGroup("create-mode-group");

    // Submit Create Room
    const btnSubmitCreate = document.getElementById("btn-submit-create-room");
    if (btnSubmitCreate) {
      btnSubmitCreate.addEventListener("click", handleCreateRoomSubmit);
    }

    // Submit Join Room
    const btnSubmitJoin = document.getElementById("btn-submit-join-room");
    if (btnSubmitJoin) {
      btnSubmitJoin.addEventListener("click", handleJoinRoomSubmit);
    }

    // Copy Invite Link in Lobby
    const btnLobbyCopy = document.getElementById("btn-lobby-copy-link");
    if (btnLobbyCopy) {
      btnLobbyCopy.addEventListener("click", () => {
        const inputInvite = document.getElementById("input-invite");
        const urlToCopy = inputInvite && inputInvite.value ? inputInvite.value : window.location.href;
        navigator.clipboard.writeText(urlToCopy).then(() => {
          const oldText = btnLobbyCopy.textContent;
          btnLobbyCopy.textContent = "COPIED!";
          setTimeout(() => { btnLobbyCopy.textContent = oldText; }, 2000);
        }).catch(() => {
          if (inputInvite) {
            inputInvite.select();
            document.execCommand("copy");
            btnLobbyCopy.textContent = "COPIED!";
            setTimeout(() => { btnLobbyCopy.textContent = "COPY LINK"; }, 2000);
          }
        });
      });
    }
  }

  function setupToggleGroup(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const btns = group.querySelectorAll(".btn-toggle");
    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  function getToggleValue(groupId, defaultVal) {
    const group = document.getElementById(groupId);
    if (!group) return defaultVal;
    const active = group.querySelector(".btn-toggle.active");
    return active ? active.dataset.value : defaultVal;
  }

  function handleCreateRoomSubmit() {
    const roomType = getToggleValue("create-room-type-group", "private");
    const mode = parseInt(getToggleValue("create-mode-group", "0"), 10) || 0;
    const slots = parseInt(document.getElementById("create-select-slots").value, 10) || 8;
    const rounds = parseInt(document.getElementById("create-select-rounds").value, 10) || 3;
    const drawtime = parseInt(document.getElementById("create-select-drawtime").value, 10) || 80;
    const lang = parseInt(document.getElementById("create-select-lang").value, 10) || 0;
    const customWords = (document.getElementById("create-input-customwords").value || "").trim();
    const customWordsOnly = document.getElementById("create-check-customonly").checked;

    closeDrawRealmModal("drawrealm-modal-create");

    // Store pending room options to pass into the login packet
    window.__drawrealmPendingRoom = {
      roomType,
      mode,
      slots,
      rounds,
      drawtime,
      lang,
      customWords,
      customWordsOnly
    };

    // Pre-populate settings onto room inputs
    const sSlots = document.getElementById("item-settings-slots");
    if (sSlots) sSlots.value = slots;
    const sRounds = document.getElementById("item-settings-rounds");
    if (sRounds) sRounds.value = rounds;
    const sDrawtime = document.getElementById("item-settings-drawtime");
    if (sDrawtime) sDrawtime.value = drawtime;
    const sLang = document.getElementById("item-settings-language");
    if (sLang) sLang.value = lang;
    const sMode = document.getElementById("item-settings-mode");
    if (sMode) {
      sMode.value = String(mode);
      sMode.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const sCustomWords = document.getElementById("item-settings-customwords");
    if (sCustomWords && customWords) sCustomWords.value = customWords;
    const sCustomOnly = document.getElementById("item-settings-customwordsonly");
    if (sCustomOnly) sCustomOnly.checked = customWordsOnly;

    // Trigger existing room creation flow
    const nativeCreateBtn = document.querySelector("#home .panel .button-create");
    if (nativeCreateBtn) {
      nativeCreateBtn.click();
    }
  }

  function handleJoinRoomSubmit() {
    const input = document.getElementById("input-join-code");
    const err = document.getElementById("join-error-msg");
    if (!input) return;
    let code = input.value.trim();
    if (!code) {
      if (err) { err.textContent = "Please enter a room code."; err.style.display = "block"; }
      return;
    }
    if (code.includes("?")) {
      code = code.split("?")[1];
    }
    code = code.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!code) {
      if (err) { err.textContent = "Invalid room code format."; err.style.display = "block"; }
      return;
    }

    // Update URL query and trigger Play
    window.history.pushState(null, "", "?" + code);
    closeDrawRealmModal("drawrealm-modal-join");
    const playBtn = document.querySelector("#home .panel .button-play");
    if (playBtn) {
      playBtn.click();
    }
  }

  function loadPublicRooms() {
    const container = document.getElementById("public-rooms-list-container");
    const countLabel = document.getElementById("public-rooms-count-label");
    if (!container) return;
    container.innerHTML = "<p style='text-align:center;padding:16px;opacity:0.7'>Loading public rooms...</p>";

    fetch("/api/rooms")
      .then(res => res.json())
      .then(rooms => {
        if (!Array.isArray(rooms) || rooms.length === 0) {
          container.innerHTML = "<p style='text-align:center;padding:24px;opacity:0.8'>No public rooms active right now.<br>Create one below to start playing!</p>";
          if (countLabel) countLabel.textContent = "0 Active Public Rooms";
          return;
        }

        if (countLabel) countLabel.textContent = `${rooms.length} Active Public Room${rooms.length > 1 ? "s" : ""}`;
        container.innerHTML = "";

        rooms.forEach(room => {
          const card = document.createElement("div");
          card.className = "public-room-card";
          const isEvo = room.mode === 6;
          const modeLabel = isEvo ? "Evolution" : "Classic";
          const isFull = room.players >= room.maxSlots;

          card.innerHTML = `
            <div class="room-info">
              <span class="room-code-tag">Room #${room.id}</span>
              <span class="room-meta">Mode: <b>${modeLabel}</b> | Players: <b>${room.players} / ${room.maxSlots}</b></span>
            </div>
            <button type="button" class="btn-room-join" ${isFull ? "disabled" : ""} data-room-id="${room.id}">
              ${isFull ? "Full" : "Join"}
            </button>
          `;

          const joinBtn = card.querySelector(".btn-room-join");
          if (joinBtn && !isFull) {
            joinBtn.addEventListener("click", () => {
              window.history.pushState(null, "", "?" + room.id);
              closeDrawRealmModal("drawrealm-modal-public");
              const playBtn = document.querySelector("#home .panel .button-play");
              if (playBtn) playBtn.click();
            });
          }
          container.appendChild(card);
        });
      })
      .catch(err => {
        container.innerHTML = "<p style='text-align:center;color:#ff4757;padding:16px'>Failed to load public rooms.</p>";
      });
  }

  // Lobby Header Synchronization
  function updateLobbyHeader() {
    const inviteInput = document.getElementById("input-invite");
    const codeDisplay = document.getElementById("lobby-code-display");
    const modeTag = document.getElementById("lobby-mode-tag");

    if (codeDisplay) {
      let code = "";
      if (inviteInput && inviteInput.value && inviteInput.value.includes("?")) {
        code = inviteInput.value.split("?")[1];
      } else if (window.location.search && window.location.search.length > 1) {
        code = window.location.search.slice(1);
      }
      if (code) {
        codeDisplay.textContent = code;
      }
    }

    if (modeTag) {
      if (isEvolutionActive) {
        modeTag.textContent = "EVOLUTION MODE";
        modeTag.className = "mode-tag mode-evolution";
      } else {
        modeTag.textContent = "CLASSIC MODE";
        modeTag.className = "mode-tag mode-classic";
      }
    }

    // Pre-game Evolution Intro check
    if (isEvolutionActive && !hasShownEvolutionIntro) {
      const gameElem = document.getElementById("game");
      if (gameElem && gameElem.style.display !== "none") {
        hasShownEvolutionIntro = true;
        openDrawRealmModal("drawrealm-modal-evolution-intro");
      }
    }
  }

  // Click listeners for power buttons & DrawRealm setup
  function init() {
    document.querySelectorAll(".evolution-power-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const slot = parseInt(btn.dataset.key);
        if (slot) activatePowerBySlot(slot);
      });
    });

    setupDrawRealmModals();
    setInterval(updateLobbyHeader, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
