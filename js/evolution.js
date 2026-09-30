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
    sock.on("evolution:pp_gain", onPpGain);
    sock.on("evolution:power_unlocked", onPowerUnlocked);
    sock.on("evolution:effect", onEvolutionEffect);
    sock.on("evolution:roster", onEvolutionRoster);
    sock.on("evolution:letter_vision", onLetterVision);
    sock.on("evolution:word_scan", onWordScan);
    sock.on("evolution:pattern_sense", onPatternSense);
    sock.on("evolution:color_burst", onColorBurst);
    sock.on("evolution:perfect_line", onPerfectLine);
    sock.on("evolution:power_used", onEvolutionPowerUsed);
    sock.on("evolution:power_activated", onPowerActivated);
    sock.on("evolution:power_error", onPowerError);
    sock.on("evolution:score_sync", (data) => {
      if (!data) return;
      const playersListEl = document.querySelector("#game-players .players-list");
      if (playersListEl) {
        const playerEls = playersListEl.querySelectorAll(".player");
        playerEls.forEach(el => {
          if (el.dataset && el.dataset.playerId == data.playerId) {
            const scoreEl = el.querySelector(".score");
            if (scoreEl) {
              scoreEl.textContent = `${data.score} points`;
            }
          }
        });
      }
    });
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

    // Sync cooldowns with cooldownEndsAt if provided to eliminate timer drift
    if (state.cooldownEndsAt) {
      const now = Date.now();
      state.cooldowns = state.cooldowns || {};
      for (const [pId, endsAt] of Object.entries(state.cooldownEndsAt)) {
        const rem = Math.max(0, Math.ceil((endsAt - now) / 1000));
        if (rem > 0) {
          state.cooldowns[pId] = rem;
        } else {
          delete state.cooldowns[pId];
        }
      }
    }

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

    // 2b. Update Power Points Badge & Unlock Button
    const ppEl = dock.querySelector("#evolution-badge-pp .pp-count");
    if (ppEl) {
      ppEl.textContent = state.powerPoints !== undefined ? state.powerPoints : 0;
    }
    const draftPpBalance = document.getElementById("draft-pp-balance");
    if (draftPpBalance) {
      draftPpBalance.textContent = `${state.powerPoints !== undefined ? state.powerPoints : 0} PP`;
    }

    const unlockBtn = document.getElementById("evolution-btn-unlock-power");
    if (unlockBtn) {
      const pp = state.powerPoints || 0;
      const choices = state.pendingDraft || [];
      const hasAffordable = choices.some(c => (c.cost || 5) <= pp && (c.levelReq || 1) <= state.level);
      const canUnlock = hasAffordable || pp >= 5;
      unlockBtn.style.display = canUnlock ? "inline-flex" : "none";
    }

    // Refresh draft modal if currently open
    const draftModal = document.getElementById("overlay-evolution-choice");
    if (draftModal && draftModal.style.display !== "none" && state.pendingDraft) {
      renderDraftModal(state.pendingDraft);
    }

    // 3. Render Normal Power Slots (Slots 0, 1, 2)
    const normalSlots = dock.querySelectorAll(".evolution-slot:not(.evolution-slot-ultimate)");
    const maxPowers = typeof state.maxPowers === "number" ? state.maxPowers : 3;
    normalSlots.forEach((slotEl, idx) => {
      const btn = slotEl.querySelector(".evolution-power-btn");
      const power = (state.equippedPowers && state.equippedPowers[idx]) || null;
      const isLocked = idx >= maxPowers;
      renderPowerButton(btn, power, idx + 1, state.cooldowns, false, isLocked, idx);
    });

    // 4. Render Ultimate Slot (Slot 3)
    const ultSlot = dock.querySelector(".evolution-slot-ultimate");
    if (ultSlot) {
      const btn = ultSlot.querySelector(".evolution-power-btn");
      const isLocked = !state.hasUltimate;
      renderPowerButton(btn, state.ultimatePower, 4, state.cooldowns, true, isLocked, 3);
    }

    // Refresh active tooltip if currently open
    if (activeTooltipBtn && document.body.contains(activeTooltipBtn)) {
      showPowerTooltip(activeTooltipBtn);
    }

    // 5. Check Pending Draft
    renderDraftModal(state.pendingDraft);

    // 6. Start / Refresh Cooldown Countdown Timer
    startCooldownTicker();
  }

  function updateUsesBadge(btn, power) {
    if (!btn) return;
    let usesBadge = btn.querySelector(".uses-badge");
    const powerObj = (typeof power === "object" && power) ? power : (evolutionState && Array.isArray(evolutionState.equippedPowers) ? evolutionState.equippedPowers.find(p => p && p.id === (typeof power === "string" ? power : btn.dataset.powerId)) : null);
    const maxUses = powerObj && powerObj.maxUses;
    if (typeof maxUses === "number" && maxUses > 0) {
      const pId = powerObj.id;
      const remaining = (evolutionState && evolutionState.usesRemaining && typeof evolutionState.usesRemaining[pId] === "number")
        ? evolutionState.usesRemaining[pId]
        : maxUses;
      if (!usesBadge) {
        usesBadge = document.createElement("span");
        usesBadge.className = "uses-badge";
        btn.appendChild(usesBadge);
      }
      usesBadge.textContent = `${remaining}/${maxUses}`;
      usesBadge.style.display = "block";
    } else if (usesBadge) {
      usesBadge.style.display = "none";
    }
  }

  function renderPowerButton(btn, power, keyNum, cooldowns, isUlt = false, isLocked = false, slotIdx = 0) {
    if (!btn) return;
    const overlay = btn.querySelector(".cooldown-overlay");
    const iconEl = btn.querySelector(".power-icon");
    const nameEl = btn.querySelector(".power-name");

    btn.dataset.slotIdx = slotIdx;
    btn.dataset.keyNum = keyNum;
    btn.dataset.key = keyNum;
    btn.dataset.isUlt = isUlt ? "true" : "false";
    btn.removeAttribute("data-tooltip");

    btn.classList.remove("locked", "empty", "available", "on-cooldown");

    if (isLocked) {
      btn.classList.add("locked");
      btn.dataset.slotState = "locked";
      btn.dataset.powerId = "";
      if (iconEl) iconEl.textContent = "";
      if (nameEl) nameEl.textContent = "LOCKED";
      if (overlay) overlay.style.display = "none";
      updateUsesBadge(btn, null);
      return;
    }

    if (!power) {
      btn.classList.add("empty");
      btn.dataset.slotState = "empty";
      btn.dataset.powerId = "";
      if (iconEl) iconEl.textContent = "";
      if (nameEl) nameEl.textContent = "EMPTY";
      if (overlay) overlay.style.display = "none";
      updateUsesBadge(btn, null);
      return;
    }

    btn.dataset.slotState = "equipped";
    btn.dataset.powerId = power.id;
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
      btn.classList.add("available");
      if (overlay) overlay.style.display = "none";
    }
    updateUsesBadge(btn, power);
  }

  function startCooldownTicker() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
      if (!evolutionState || !evolutionState.cooldowns) return;
      let hasActiveCd = false;
      const now = Date.now();

      if (evolutionState.cooldownEndsAt) {
        for (const [pId, endsAt] of Object.entries(evolutionState.cooldownEndsAt)) {
          const rem = Math.max(0, Math.ceil((endsAt - now) / 1000));
          if (rem > 0) {
            evolutionState.cooldowns[pId] = rem;
            hasActiveCd = true;
          } else {
            delete evolutionState.cooldowns[pId];
            delete evolutionState.cooldownEndsAt[pId];
          }
        }
      } else {
        for (const [pId, sec] of Object.entries(evolutionState.cooldowns)) {
          if (sec > 1) {
            evolutionState.cooldowns[pId] = sec - 1;
            hasActiveCd = true;
          } else {
            delete evolutionState.cooldowns[pId];
          }
        }
      }

      // Update cooldown UI overlays and classes
      const buttons = document.querySelectorAll(".evolution-power-btn");
      buttons.forEach(btn => {
        if (btn.dataset.slotState !== "equipped") return;
        const pId = btn.dataset.powerId;
        const overlay = btn.querySelector(".cooldown-overlay");
        const remaining = (evolutionState.cooldowns && evolutionState.cooldowns[pId]) || 0;
        if (remaining > 0) {
          btn.classList.add("on-cooldown");
          btn.classList.remove("available");
          if (overlay) {
            overlay.style.display = "flex";
            overlay.textContent = `${remaining}s`;
          }
        } else {
          btn.classList.remove("on-cooldown");
          btn.classList.add("available");
          if (overlay) overlay.style.display = "none";
        }
      });

      // If active tooltip is open for an equipped power on cooldown, refresh display
      if (activeTooltipBtn && activeTooltipBtn.dataset.slotState === "equipped") {
        showPowerTooltip(activeTooltipBtn);
      }

      if (!hasActiveCd) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
    }, 1000);
  }

  function showPpToast(amount, reason) {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    const toast = document.createElement("div");
    toast.className = "evolution-pp-toast";
    toast.textContent = `+${amount} PP (${reason || "Gameplay"})`;
    canvas.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2000);
  }

  function onPpGain(data) {
    if (!data) return;
    showPpToast(data.amount, data.reason);
    const ppEl = document.querySelector("#evolution-badge-pp .pp-count");
    if (ppEl && typeof data.totalPP === "number") {
      ppEl.textContent = data.totalPP;
    }
    const draftPpBalance = document.getElementById("draft-pp-balance");
    if (draftPpBalance && typeof data.totalPP === "number") {
      draftPpBalance.textContent = `${data.totalPP} PP`;
    }
  }

  function onPowerUnlocked(data) {
    if (!data) return;
    appendSystemChatMessage(`🎉 Unlocked power: ${data.powerName}! (${data.remainingPP} PP remaining)`, "#22c55e");
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

    const currentPP = (evolutionState && typeof evolutionState.powerPoints === "number") ? evolutionState.powerPoints : 0;
    const currentLevel = (evolutionState && typeof evolutionState.level === "number") ? evolutionState.level : 0;

    const draftPpBalance = document.getElementById("draft-pp-balance");
    if (draftPpBalance) {
      draftPpBalance.textContent = `${currentPP} PP`;
    }

    container.innerHTML = "";
    draftChoices.forEach(choice => {
      const card = document.createElement("div");
      card.className = "evolution-choice-card";

      const cost = choice.cost || 5;
      const levelReq = choice.isUltimate ? 10 : (choice.levelReq || 1);
      const isLevelMet = currentLevel >= levelReq;
      const canAfford = currentPP >= cost;

      let btnClass = "btn-choice-unlock affordable";
      let btnText = `UNLOCK (${cost} PP)`;
      let btnDisabled = false;

      if (!isLevelMet) {
        btnClass = "btn-choice-unlock locked";
        btnText = `LOCKED (Req. Lvl ${levelReq})`;
        btnDisabled = true;
      } else if (!canAfford) {
        btnClass = "btn-choice-unlock unaffordable";
        btnText = `Need ${cost} PP (Have ${currentPP})`;
        btnDisabled = true;
      }

      const branchCode = getBranchBadge(choice.branch, choice.id);

      card.innerHTML = `
        <div class="choice-icon">${choice.icon || "✨"}</div>
        <div class="choice-name">${choice.name.toUpperCase()}</div>
        <div class="choice-badges">
          <span class="choice-branch">[${branchCode}]</span>
          <span class="choice-rarity" style="color:${getRarityColor(choice.rarity)}">${choice.rarity.toUpperCase()}</span>
        </div>
        <div class="choice-level-req ${isLevelMet ? "met" : "locked"}">
          ${isLevelMet ? `✓ Level ${levelReq}+ Met` : `🔒 Requires Level ${levelReq}`}
        </div>
        <div class="choice-cost">Cost: ${cost} PP</div>
        <div class="choice-desc">${choice.description}</div>
        <button class="${btnClass}" ${btnDisabled ? "disabled" : ""}>${btnText}</button>
      `;

      const unlockBtn = card.querySelector(".btn-choice-unlock");
      if (unlockBtn && !btnDisabled) {
        unlockBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (socket) {
            socket.emit("evolution:unlock_power", { powerId: choice.id });
          }
          modal.style.display = "none";
        });
      }

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

  const LEVEL_TITLES = [
    "Human", "Scout", "Swift", "Creator", "Mind Reader",
    "Guardian", "Berserker", "Manipulator", "Elite", "Master", "Evolution"
  ];

  function getLevelTitle(lvl) {
    return LEVEL_TITLES[lvl] || "Unknown";
  }

  function getBranchBadge(branch, powerId) {
    if (!branch) return "EVO";
    const b = branch.toLowerCase();
    if (b === "attack") return "ATK";
    if (b === "creator") return "CRE";
    if (b === "defense") return "DEF";
    if (b === "intelligence") return "INT";
    if (b === "chaos") return "CHA";
    if (b === "ultimate") return "ULT";
    return "EVO";
  }

  function formatBranchName(branch) {
    if (!branch) return "General";
    return branch.charAt(0).toUpperCase() + branch.slice(1).toLowerCase();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[m]);
  }

  let activeTooltipBtn = null;
  let tooltipHideTimeout = null;

  function createTooltipElement() {
    let tt = document.getElementById("evolution-power-tooltip");
    if (!tt) {
      tt = document.createElement("div");
      tt.id = "evolution-power-tooltip";
      document.body.appendChild(tt);

      tt.addEventListener("mouseenter", () => {
        if (tooltipHideTimeout) {
          clearTimeout(tooltipHideTimeout);
          tooltipHideTimeout = null;
        }
      });
      tt.addEventListener("mouseleave", () => {
        hidePowerTooltip(150);
      });
    }
    return tt;
  }

  function createContextMenuElement() {
    let menu = document.getElementById("evolution-context-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "evolution-context-menu";
      menu.innerHTML = `<div class="context-menu-item" id="btn-context-unequip">UNEQUIP POWER</div>`;
      document.body.appendChild(menu);

      const unequipItem = menu.querySelector("#btn-context-unequip");
      unequipItem.addEventListener("click", () => {
        const powerId = menu.dataset.powerId;
        if (powerId && socket) {
          socket.emit("evolution:unequip_power", { powerId });
        }
        hideContextMenu();
        hidePowerTooltip(0);
      });

      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target)) hideContextMenu();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideContextMenu();
      });
    }
    return menu;
  }

  function showPowerTooltip(btn) {
    if (!evolutionState) return;
    const tt = createTooltipElement();
    activeTooltipBtn = btn;
    if (tooltipHideTimeout) {
      clearTimeout(tooltipHideTimeout);
      tooltipHideTimeout = null;
    }

    const slotState = btn.dataset.slotState || (btn.classList.contains("empty") ? "empty" : btn.classList.contains("locked") ? "locked" : "equipped");
    const slotIdx = parseInt(btn.dataset.slotIdx, 10);
    const keyNum = btn.dataset.keyNum || (slotIdx + 1);
    const isUlt = btn.dataset.isUlt === "true";
    const powerId = btn.dataset.powerId;

    let contentHtml = "";

    if (slotState === "locked") {
      const reqLvl = isUlt ? 7 : (slotIdx + 1);
      const reqTitle = getLevelTitle(reqLvl);
      contentHtml = `
        <div class="evo-tt-header">
          <span class="evo-tt-name">LOCKED ${isUlt ? "ULTIMATE " : ""}SLOT</span>
          <span class="evo-tt-rarity" style="border-color:#94a3b8;color:#64748b">LOCKED</span>
        </div>
        <div class="evo-tt-desc">
          Unlocks at Evolution Level <b>${reqLvl}</b> (${reqTitle}).
        </div>
        <div class="evo-tt-meta">
          <div class="evo-tt-meta-item"><span>Slot Hotkey:</span> <span class="val">[${keyNum}]</span></div>
          <div class="evo-tt-meta-item"><span>Requirement:</span> <span class="val">Level ${reqLvl}</span></div>
        </div>
      `;
    } else if (slotState === "empty") {
      const unlocked = evolutionState.unlockedPowers || [];
      const equippedIds = new Set((evolutionState.equippedPowers || []).map(p => p.id));
      if (evolutionState.ultimatePower) equippedIds.add(evolutionState.ultimatePower.id);

      const availableToEquip = unlocked.filter(p => {
        if (isUlt) return p.isUltimate && !equippedIds.has(p.id);
        return !p.isUltimate && !equippedIds.has(p.id);
      });

      contentHtml = `
        <div class="evo-tt-header">
          <span class="evo-tt-name">EMPTY ${isUlt ? "ULTIMATE " : ""}SLOT</span>
          <span class="evo-tt-rarity" style="border-color:#3b82f6;color:#2563eb">EMPTY</span>
        </div>
        <div class="evo-tt-desc">No power equipped in this slot. Hotkey: <b>[${keyNum}]</b></div>
      `;

      if (availableToEquip.length > 0) {
        contentHtml += `
          <div style="font-size:10px;font-weight:900;color:#1e293b;margin-top:6px;margin-bottom:3px;letter-spacing:0.5px;">CHOOSE A POWER TO EQUIP:</div>
          <div class="evo-tt-equip-list">
        `;
        availableToEquip.forEach(p => {
          const rColor = getRarityColor(p.rarity);
          const bBadge = getBranchBadge(p.branch, p.id);
          contentHtml += `
            <div class="evo-tt-equip-item" data-power-id="${p.id}" data-slot-idx="${slotIdx}">
              <span><b style="color:${rColor}">[${bBadge}]</b> ${escapeHtml(p.name)}</span>
              <span style="font-size:10px;color:#64748b">${p.cooldown || 40}s</span>
            </div>
          `;
        });
        contentHtml += `</div>`;
      } else {
        contentHtml += `
          <div style="font-size:11px;font-style:italic;color:#64748b;margin-top:4px;">
            Level up to draft new powers from Evolution choices!
          </div>
        `;
      }
    } else {
      // Equipped power
      let power = null;
      if (isUlt && evolutionState.ultimatePower && evolutionState.ultimatePower.id === powerId) {
        power = evolutionState.ultimatePower;
      } else if (Array.isArray(evolutionState.equippedPowers)) {
        power = evolutionState.equippedPowers.find(p => p.id === powerId);
      }
      if (!power && Array.isArray(evolutionState.unlockedPowers)) {
        power = evolutionState.unlockedPowers.find(p => p.id === powerId);
      }

      if (!power) return;

      const rColor = getRarityColor(power.rarity);
      const remainingCd = (evolutionState.cooldowns && evolutionState.cooldowns[power.id]) || 0;
      const cdText = remainingCd > 0 ? `${remainingCd}s remaining (${power.cooldown || 40}s base)` : `${power.cooldown || 40}s`;

      const roleText = (power.allowedRoles && power.allowedRoles.length === 1)
        ? (power.allowedRoles[0] === "drawer" ? "Drawer only" : "Guesser only")
        : "Any role";

      const maxUses = power.maxUses;
      const usesRem = (evolutionState.usesRemaining && typeof evolutionState.usesRemaining[power.id] === "number")
        ? evolutionState.usesRemaining[power.id]
        : (maxUses || "Unlimited");
      const usesText = maxUses ? `${usesRem} / ${maxUses}` : "Unlimited";

      contentHtml = `
        <div class="evo-tt-header">
          <span class="evo-tt-name">${escapeHtml(power.name).toUpperCase()}</span>
          <span class="evo-tt-rarity" style="border-color:${rColor};color:${rColor}">${power.rarity.toUpperCase()}</span>
        </div>
        <div class="evo-tt-desc">${escapeHtml(power.description)}</div>
        <div class="evo-tt-meta">
          <div class="evo-tt-meta-item"><span>Branch:</span> <span class="val">${formatBranchName(power.branch)}</span></div>
          <div class="evo-tt-meta-item"><span>Required Role:</span> <span class="val">${roleText}</span></div>
          <div class="evo-tt-meta-item"><span>Level Req:</span> <span class="val">Level ${power.levelReq || 1}</span></div>
          <div class="evo-tt-meta-item"><span>Uses:</span> <span class="val">${usesText}</span></div>
          <div class="evo-tt-meta-item"><span>Cooldown:</span> <span class="val" style="${remainingCd > 0 ? 'color:#dc2626' : ''}">${cdText}</span></div>
          <div class="evo-tt-meta-item"><span>Hotkey:</span> <span class="val">[Key: ${keyNum}]</span></div>
        </div>
        <button type="button" class="evo-tt-unequip-btn" data-power-id="${power.id}">UNEQUIP POWER</button>
      `;
    }

    tt.innerHTML = contentHtml;

    tt.querySelectorAll(".evo-tt-equip-item").forEach(item => {
      item.addEventListener("click", () => {
        const pId = item.dataset.powerId;
        const sIdx = parseInt(item.dataset.slotIdx, 10);
        if (pId && socket) {
          socket.emit("evolution:equip_power", { powerId: pId, slot: sIdx });
        }
        hidePowerTooltip(0);
      });
    });

    const unequipBtn = tt.querySelector(".evo-tt-unequip-btn");
    if (unequipBtn) {
      unequipBtn.addEventListener("click", () => {
        const pId = unequipBtn.dataset.powerId;
        if (pId && socket) {
          socket.emit("evolution:unequip_power", { powerId: pId });
        }
        hidePowerTooltip(0);
      });
    }

    positionTooltip(tt, btn);
    tt.classList.add("visible");
  }

  function positionTooltip(tt, btn) {
    const btnRect = btn.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();

    let left = btnRect.left + (btnRect.width / 2) - (ttRect.width / 2);
    left = Math.max(10, Math.min(window.innerWidth - ttRect.width - 10, left));

    let top = btnRect.top - ttRect.height - 10;
    if (top < 10) {
      top = btnRect.bottom + 10;
    }

    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
  }

  function hidePowerTooltip(delay = 150) {
    if (tooltipHideTimeout) clearTimeout(tooltipHideTimeout);
    tooltipHideTimeout = setTimeout(() => {
      const tt = document.getElementById("evolution-power-tooltip");
      if (tt) {
        tt.classList.remove("visible");
      }
      activeTooltipBtn = null;
    }, delay);
  }

  function showContextMenu(e, btn) {
    e.preventDefault();
    if (!btn || btn.dataset.slotState !== "equipped") return;
    const powerId = btn.dataset.powerId;
    if (!powerId) return;

    hidePowerTooltip(0);
    const menu = createContextMenuElement();
    menu.dataset.powerId = powerId;
    menu.style.display = "block";

    let left = e.clientX;
    let top = e.clientY;
    const menuWidth = 150;
    const menuHeight = 40;
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function hideContextMenu() {
    const menu = document.getElementById("evolution-context-menu");
    if (menu) menu.style.display = "none";
  }

  function onEvolutionPowerUsed(data) {
    if (!data || !data.playerId) return;

    let playerEl = document.querySelector(`.player[data-player-id="${data.playerId}"]`);
    if (!playerEl) {
      const allPlayers = document.querySelectorAll("#game-players .player");
      for (const p of allPlayers) {
        const nameEl = p.querySelector(".player-name");
        if (nameEl && nameEl.textContent.trim().toLowerCase().includes(data.playerName.toLowerCase())) {
          playerEl = p;
          break;
        }
      }
    }
    if (!playerEl) return;

    let stack = playerEl.querySelector(".player-power-feedback-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "player-power-feedback-stack";
      playerEl.appendChild(stack);
    }

    while (stack.children.length >= 3) {
      stack.firstElementChild.remove();
    }

    const branchBadge = getBranchBadge(data.powerBranch, data.powerId);
    const rarityColor = getRarityColor(data.powerRarity);

    const card = document.createElement("div");
    card.className = "player-power-feedback-item";
    card.style.borderLeftColor = rarityColor;
    card.innerHTML = `
      <span class="feedback-badge" style="color:${rarityColor}">[${branchBadge}]</span>
      <span class="feedback-text">USED: <b>${escapeHtml(data.powerName).toUpperCase()}</b></span>
    `;

    stack.appendChild(card);

    setTimeout(() => {
      card.classList.add("fade-out");
      setTimeout(() => {
        card.remove();
        if (stack && stack.children.length === 0) {
          stack.remove();
        }
      }, 250);
    }, 1200);
  }

  function activatePowerBySlot(slotNum) {
    if (!isEvolutionActive || !socket) return;
    const dock = document.getElementById("evolution-dock");
    if (!dock) return;

    const btn = dock.querySelector(`.evolution-power-btn[data-key="${slotNum}"]`) ||
                dock.querySelector(`.evolution-power-btn[data-key-num="${slotNum}"]`);
    if (!btn || btn.classList.contains("empty") || btn.classList.contains("locked") || btn.classList.contains("on-cooldown")) return;

    const pId = btn.dataset.powerId;
    if (pId) {
      btn.classList.add("clicked");
      setTimeout(() => btn.classList.remove("clicked"), 200);
      const powerRequestId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      socket.emit("evolution:activate_power", {
        powerId: pId,
        powerRequestId: powerRequestId
      });
    }
  }

  function onPowerError(data) {
    if (!data) return;
    const reason = data.reason || "Action not allowed";
    const powerId = data.powerId;

    if (powerId) {
      const btn = document.querySelector(`.evolution-power-btn[data-power-id="${powerId}"]`);
      if (btn) {
        btn.classList.remove("error-shake");
        void btn.offsetWidth; // Force reflow for shake animation
        btn.classList.add("error-shake");
        setTimeout(() => btn.classList.remove("error-shake"), 400);
      }
    }

    showPowerErrorToast(reason);
    appendSystemChatMessage(`⚠️ ${reason}`, "#ef4444");
  }

  function showPowerErrorToast(msg) {
    const dock = document.getElementById("evolution-dock");
    if (!dock) return;
    let toast = document.getElementById("evo-error-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "evo-error-toast";
      toast.className = "evolution-power-error-toast";
      dock.appendChild(toast);
    }
    toast.textContent = `⚠️ ${msg}`;
    toast.classList.add("visible");
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 3200);
  }

  function onPowerActivated(data) {
    if (!data) return;
    const myId = evolutionState ? evolutionState.playerId : null;
    if (myId && data.playerId === myId) {
      if (!evolutionState.cooldowns) evolutionState.cooldowns = {};
      if (typeof data.cooldown === "number" && data.cooldown > 0) {
        evolutionState.cooldowns[data.powerId] = data.cooldown;
      }
      if (data.cooldownEndsAt) {
        if (!evolutionState.cooldownEndsAt) evolutionState.cooldownEndsAt = {};
        evolutionState.cooldownEndsAt[data.powerId] = data.cooldownEndsAt;
      }
      if (evolutionState.usesRemaining && typeof data.usesRemaining === "number") {
        evolutionState.usesRemaining[data.powerId] = data.usesRemaining;
      }

      const btn = document.querySelector(`.evolution-power-btn[data-power-id="${data.powerId}"]`);
      if (btn) {
        const remaining = data.cooldown || 0;
        const overlay = btn.querySelector(".cooldown-overlay");
        if (remaining > 0) {
          btn.classList.add("on-cooldown");
          btn.classList.remove("available");
          if (overlay) {
            overlay.style.display = "flex";
            overlay.textContent = `${remaining}s`;
          }
        }
        updateUsesBadge(btn, data.powerId);
      }

      startCooldownTicker();
    }
  }

  function onXpGain(data) {
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
    if (!data || !data.type) return;

    if (data.type === "reverse_canvas") {
      const myId = evolutionState ? evolutionState.playerId : null;
      if (Array.isArray(data.immunePlayerIds) && myId && data.immunePlayerIds.includes(myId)) {
        appendSystemChatMessage("🛡️ Mirror Shield protected you from Reverse Canvas!", "#22c55e");
        return;
      }
      const cvs = document.querySelector("#game-canvas canvas");
      if (cvs) {
        cvs.style.transform = "scaleX(-1)";
        setTimeout(() => {
          cvs.style.transform = "";
        }, (data.duration || 15) * 1000);
      }
    } else if (data.type === "ghost_canvas") {
      let ghostCanvas = document.getElementById("evo-ghost-canvas");
      const mainCanvas = document.querySelector("#game-canvas canvas");
      if (!ghostCanvas && mainCanvas && mainCanvas.parentElement) {
        ghostCanvas = document.createElement("canvas");
        ghostCanvas.id = "evo-ghost-canvas";
        ghostCanvas.width = mainCanvas.width || 800;
        ghostCanvas.height = mainCanvas.height || 600;
        ghostCanvas.style.position = "absolute";
        ghostCanvas.style.top = "0";
        ghostCanvas.style.left = "0";
        ghostCanvas.style.width = "100%";
        ghostCanvas.style.height = "100%";
        ghostCanvas.style.pointerEvents = "none";
        ghostCanvas.style.opacity = "0.25";
        ghostCanvas.style.zIndex = "5";
        mainCanvas.parentElement.appendChild(ghostCanvas);
      }
      if (ghostCanvas && Array.isArray(data.commands)) {
        const gctx = ghostCanvas.getContext("2d");
        gctx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
        for (const cmd of data.commands) {
          if (Array.isArray(cmd) && cmd[0] === 0) {
            gctx.strokeStyle = "rgba(60, 60, 60, 0.75)";
            gctx.lineWidth = cmd[2] || 6;
            gctx.lineCap = "round";
            gctx.lineJoin = "round";
            gctx.beginPath();
            gctx.moveTo(cmd[3], cmd[4]);
            gctx.lineTo(cmd[5], cmd[6]);
            gctx.stroke();
          }
        }
        setTimeout(() => {
          if (ghostCanvas && ghostCanvas.parentElement) {
            ghostCanvas.remove();
          }
        }, (data.duration || 12) * 1000);
      }
    } else if (data.type === "chaos_brush") {
      const sizeButtons = document.querySelectorAll("#game-toolbar .sizes .size");
      if (sizeButtons.length > 0) {
        sizeButtons[sizeButtons.length - 1].click();
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
    if (!data) return;
    appendSystemChatMessage(`🔍 [Word Scan] Length: ${data.length} letters • Category: ${data.category}`, "#38bdf8");
    const canvasWrap = document.getElementById("game-canvas");
    if (canvasWrap) {
      let scanPill = document.getElementById("evo-word-scan-pill");
      if (!scanPill) {
        scanPill = document.createElement("div");
        scanPill.id = "evo-word-scan-pill";
        scanPill.className = "evolution-hud-pill";
        canvasWrap.appendChild(scanPill);
      }
      scanPill.innerHTML = `🔍 <b>WORD SCAN:</b> ${data.length} letters &bull; Topic: <span style="color:#fde047">${escapeHtml(data.category)}</span>`;
      scanPill.classList.add("visible");
      if (scanPill._timer) clearTimeout(scanPill._timer);
      scanPill._timer = setTimeout(() => {
        scanPill.classList.remove("visible");
      }, 8000);
    }
  }

  function onPatternSense(data) {
    if (!data) return;
    appendSystemChatMessage(`🔮 [Pattern Sense] First letter: '${data.first.toUpperCase()}', Last letter: '${data.last.toUpperCase()}'`, "#38bdf8");
    const hintsContainer = document.querySelector("#game-word .hints .container");
    if (hintsContainer) {
      const hintElements = hintsContainer.querySelectorAll(".hint");
      if (hintElements.length > 0) {
        hintElements[0].textContent = data.first;
        hintElements[0].classList.add("uncover", "evolution-hint");
        const lastEl = hintElements[hintElements.length - 1];
        lastEl.textContent = data.last;
        lastEl.classList.add("uncover", "evolution-hint");
      }
    }
  }

  let colorBurstTimeout = null;
  function onColorBurst(data) {
    const duration = (data && data.duration) || 30;
    appendSystemChatMessage(`🎨 [Color Burst] 6 vibrant bonus colors unlocked on toolbar for ${duration}s!`, "#a855f7");
    const toolbar = document.querySelector("#game-toolbar .colors");
    if (toolbar) {
      toolbar.classList.add("color-burst-active");
    }
    if (colorBurstTimeout) clearTimeout(colorBurstTimeout);
    colorBurstTimeout = setTimeout(() => {
      if (toolbar) toolbar.classList.remove("color-burst-active");
    }, duration * 1000);
  }

  function onPerfectLine(data) {
    const duration = (data && data.duration) || 25;
    appendSystemChatMessage(`📐 [Perfect Line] Line assist active for ${duration}s! Strokes snap straight.`, "#22c55e");
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
  // DRAWREALM PLAYER NAME VALIDATION & FEEDBACK
  // ========================================================
  function validatePlayerName(name) {
    if (typeof name !== "string") {
      return { valid: false, cleanName: "", error: "Please enter your player name." };
    }
    const cleanName = name.trim();
    if (!cleanName || cleanName.length === 0) {
      return { valid: false, cleanName: "", error: "Please enter your player name." };
    }
    if (cleanName.length < 2) {
      return { valid: false, cleanName, error: "Player name must be at least 2 characters." };
    }
    const validCharRegex = /^[a-zA-Z0-9 _-]+$/;
    if (!validCharRegex.test(cleanName)) {
      return { valid: false, cleanName, error: "Player name can only contain letters, numbers, spaces, _ and -." };
    }
    if (cleanName.length > 20) {
      return { valid: false, cleanName, error: "Player name must be 20 characters or fewer." };
    }
    return { valid: true, cleanName, error: null };
  }

  function showNameValidationError(msg) {
    const nameInput = document.querySelector("#home .container-name-lang input") || document.querySelector(".input-name");
    const errorContainer = document.getElementById("name-validation-msg");
    if (errorContainer) {
      errorContainer.textContent = msg || "Please enter your player name.";
      errorContainer.style.display = "flex";
    }
    if (nameInput) {
      nameInput.classList.remove("input-error");
      void nameInput.offsetWidth; // trigger reflow for CSS animation
      nameInput.classList.add("input-error");
      nameInput.focus();
    }
  }

  function clearNameValidationError() {
    const nameInput = document.querySelector("#home .container-name-lang input") || document.querySelector(".input-name");
    const errorContainer = document.getElementById("name-validation-msg");
    if (errorContainer) {
      errorContainer.style.display = "none";
      errorContainer.textContent = "";
    }
    if (nameInput) {
      nameInput.classList.remove("input-error");
    }
  }

  function getValidatedPlayerName(showUiError = true) {
    const nameInput = document.querySelector("#home .container-name-lang input") || document.querySelector(".input-name");
    const rawName = nameInput ? nameInput.value : "";
    const res = validatePlayerName(rawName);
    if (!res.valid) {
      if (showUiError) {
        showNameValidationError(res.error);
      }
      return null;
    }
    clearNameValidationError();
    if (nameInput && nameInput.value !== res.cleanName) {
      nameInput.value = res.cleanName;
    }
    try {
      if (window.localStorage) {
        localStorage.setItem("name", res.cleanName);
      }
    } catch (e) {}
    return res.cleanName;
  }

  window.validatePlayerName = validatePlayerName;
  window.getValidatedPlayerName = getValidatedPlayerName;
  window.showNameValidationError = showNameValidationError;
  window.clearNameValidationError = clearNameValidationError;

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
    // Live clearing on player name input
    const nameInput = document.querySelector("#home .container-name-lang input") || document.querySelector(".input-name");
    if (nameInput) {
      nameInput.addEventListener("input", clearNameValidationError);
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const playBtn = document.querySelector("#home .panel .button-play");
          if (playBtn) playBtn.click();
        }
      });
    }

    // Open Buttons with Name Validation Guards
    const btnCreate = document.getElementById("btn-create-room-open");
    if (btnCreate) {
      btnCreate.addEventListener("click", (e) => {
        const validName = getValidatedPlayerName(true);
        if (!validName) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        openDrawRealmModal("drawrealm-modal-create");
      });
    }

    const btnJoin = document.getElementById("btn-join-room-open");
    if (btnJoin) {
      btnJoin.addEventListener("click", (e) => {
        const validName = getValidatedPlayerName(true);
        if (!validName) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const err = document.getElementById("join-error-msg");
        if (err) err.style.display = "none";
        openDrawRealmModal("drawrealm-modal-join");
      });
    }

    const btnPublic = document.getElementById("btn-public-rooms-open");
    if (btnPublic) {
      btnPublic.addEventListener("click", (e) => {
        const validName = getValidatedPlayerName(true);
        if (!validName) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
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
    const validName = getValidatedPlayerName(true);
    if (!validName) {
      return;
    }

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
    const validName = getValidatedPlayerName(true);
    if (!validName) {
      return;
    }

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
              const validName = getValidatedPlayerName(true);
              if (!validName) {
                closeDrawRealmModal("drawrealm-modal-public");
                return;
              }
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

  // Click listeners for power buttons, tooltips, context menu & DrawRealm setup
  function init() {
    createTooltipElement();
    createContextMenuElement();

    document.querySelectorAll(".evolution-power-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const slot = parseInt(btn.dataset.key || btn.dataset.keyNum, 10);
        if (btn.classList.contains("empty") || btn.classList.contains("locked")) {
          showPowerTooltip(btn);
        } else if (slot) {
          activatePowerBySlot(slot);
        }
      });

      btn.addEventListener("mouseenter", () => showPowerTooltip(btn));
      btn.addEventListener("mouseleave", () => hidePowerTooltip(150));
      btn.addEventListener("contextmenu", (e) => showContextMenu(e, btn));
    });

    setupDrawRealmModals();
    setInterval(updateLobbyHeader, 1000);

    // Power Points unlock button & modal handlers
    const unlockBtn = document.getElementById("evolution-btn-unlock-power");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", () => {
        if (socket) socket.emit("evolution:request_draft");
        if (evolutionState && evolutionState.pendingDraft) {
          renderDraftModal(evolutionState.pendingDraft);
        }
      });
    }

    const closeDraftBtn = document.getElementById("btn-evolution-draft-close");
    if (closeDraftBtn) {
      closeDraftBtn.addEventListener("click", () => {
        const modal = document.getElementById("overlay-evolution-choice");
        if (modal) modal.style.display = "none";
      });
    }

    const ppBadge = document.getElementById("evolution-badge-pp");
    if (ppBadge) {
      ppBadge.style.cursor = "pointer";
      ppBadge.addEventListener("click", () => {
        if (socket) socket.emit("evolution:request_draft");
        if (evolutionState && evolutionState.pendingDraft) {
          renderDraftModal(evolutionState.pendingDraft);
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
