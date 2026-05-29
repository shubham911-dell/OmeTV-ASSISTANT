(() => {
  const base = globalThis.OmeTVAssistant;
  const storage = globalThis.OmeTVAssistantStorage;
  const history = globalThis.OmeTVAssistantHistory;
  if (!base || !storage) return;

  let el = {};
  let keyButtons = [];
  let listToggles = [];

  let currentSettings = null;
  let captureAction = null;
  let statsTimer = null;
  const dropdownControls = [];

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    cacheElements();
    if (!hasRequiredElements()) return;
    bindEvents();
    loadSettings();
    startStatsPolling();
    if (history && history.ensureHistory) {
      history.ensureHistory();
    }
    storage.onSettingsChange(renderSettings);
  }

  function cacheElements() {
    el = {
      statusAutoSkip: document.getElementById("statusAutoSkip"),
      toggleAutoSkip: document.getElementById("toggleAutoSkip"),
      speedMode: document.getElementById("speedMode"),
      blockedInput: document.getElementById("blockedInput"),
      blockedList: document.getElementById("blockedList"),
      blockedDropdown: document.getElementById("blockedDropdown"),
      onlyInput: document.getElementById("onlyInput"),
      onlyList: document.getElementById("onlyList"),
      onlyDropdown: document.getElementById("onlyDropdown"),
      keyNext: document.getElementById("keyNext"),
      keyStop: document.getElementById("keyStop"),
      keyHint: document.getElementById("keyHint"),
      statPeople: document.getElementById("statPeople"),
      statSkippedYou: document.getElementById("statSkippedYou"),
      statSkippedOthers: document.getElementById("statSkippedOthers"),
      statSessionTime: document.getElementById("statSessionTime"),
      statTotalSkips: document.getElementById("statTotalSkips"),
      statTopChatCountry: document.getElementById("statTopChatCountry"),
      statTopChatTime: document.getElementById("statTopChatTime"),
      openHistory: document.getElementById("openHistory"),
      historyLayer: document.getElementById("historyLayer"),
      historyContent: document.getElementById("historyContent"),
      closeHistory: document.getElementById("closeHistory"),
      resetSession: document.getElementById("resetSession")
    };

    keyButtons = Array.from(
      document.querySelectorAll("button[data-action]")
    );
    listToggles = Array.from(document.querySelectorAll(".list-toggle"));
  }

  function hasRequiredElements() {
    return Boolean(
      el.statusAutoSkip &&
        el.toggleAutoSkip &&
        el.speedMode &&
        el.blockedInput &&
        el.blockedList &&
        el.blockedDropdown &&
        el.onlyInput &&
        el.onlyList &&
        el.onlyDropdown &&
        el.keyNext &&
        el.keyStop &&
        el.keyHint &&
        el.statPeople &&
        el.statSkippedYou &&
        el.statSkippedOthers &&
        el.statSessionTime &&
        el.openHistory &&
        el.historyLayer &&
        el.historyContent &&
        el.closeHistory
    );
  }

  function bindEvents() {
    el.toggleAutoSkip.addEventListener("click", () => {
      if (!currentSettings) return;
      storage.updateSettings({
        autoSkipEnabled: !currentSettings.autoSkipEnabled
      });
    });

    el.speedMode.addEventListener("change", () => {
      storage.updateSettings({ speedMode: el.speedMode.value });
    });

    setupDropdown(el.blockedInput, el.blockedDropdown, () => {
      addCountry("blocked", el.blockedInput.value);
    });

    setupDropdown(el.onlyInput, el.onlyDropdown, () => {
      addCountry("only", el.onlyInput.value);
    });

    el.blockedList.addEventListener("click", (e) => {
      const target = e.target;
      if (!target || !target.matches("button[data-country]")) return;
      removeCountry("blocked", target.getAttribute("data-country"));
    });

    el.onlyList.addEventListener("click", (e) => {
      const target = e.target;
      if (!target || !target.matches("button[data-country]")) return;
      removeCountry("only", target.getAttribute("data-country"));
    });

    listToggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const panel = toggle.closest(".list-panel");
        if (!panel) return;
        panel.classList.toggle("collapsed");
        const expanded = !panel.classList.contains("collapsed");
        toggle.setAttribute("aria-expanded", String(expanded));
      });
    });

    keyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        startKeyCapture(button.getAttribute("data-action"));
      });
    });

    document.addEventListener("keydown", (e) => {
      if (!captureAction) return;
      e.preventDefault();

      if (e.key === "Escape") {
        stopKeyCapture();
        return;
      }

      if (!base.isAllowedKey(e.key)) {
        el.keyHint.textContent = "Only arrow keys are allowed.";
        el.keyHint.classList.add("active");
        return;
      }

      const keymap = Object.assign({}, currentSettings.keymap);
      keymap[captureAction] = e.key;
      storage.updateSettings({ keymap });
      stopKeyCapture();
    });

    if (el.resetSession) {
      el.resetSession.addEventListener("click", async () => {
        await sendToActiveTab({ type: "omeTvAssistant:resetSession" });
        refreshStats();
      });
    }

    el.openHistory.addEventListener("click", () => {
      openHistory();
    });

    el.closeHistory.addEventListener("click", () => {
      closeHistory();
    });

    el.historyLayer.addEventListener("click", (e) => {
      const action = e.target.getAttribute("data-action");
      if (action === "close-history") {
        closeHistory();
      }
    });

    document.addEventListener("click", (e) => {
      dropdownControls.forEach(({ input, dropdown, close }) => {
        if (!dropdown.classList.contains("open")) return;
        if (input.contains(e.target) || dropdown.contains(e.target)) return;
        close();
      });
    });

    window.addEventListener("unload", () => {
      if (statsTimer) clearInterval(statsTimer);
    });
  }

  function setupDropdown(input, dropdown, onAdd) {
    function renderDropdown() {
      const query = String(input.value || "").trim().toLowerCase();
      const matches = base.COUNTRY_LIST.filter((name) =>
        name.toLowerCase().includes(query)
      ).slice(0, 8);

      dropdown.innerHTML = "";
      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "dropdown-item";
        empty.textContent = "No matches";
        dropdown.appendChild(empty);
        return;
      }

      matches.forEach((name) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = name;
        item.setAttribute("data-value", name);
        dropdown.appendChild(item);
      });
    }

    function open() {
      renderDropdown();
      dropdown.classList.add("open");
    }

    function close() {
      dropdown.classList.remove("open");
    }

    input.addEventListener("focus", open);
    input.addEventListener("input", open);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAdd();
        input.value = "";
        close();
        return;
      }
      if (e.key === "Escape") {
        close();
        input.blur();
      }
    });

    dropdown.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const item = e.target.closest(".dropdown-item");
      if (!item) return;
      const value = item.getAttribute("data-value");
      if (!value) return;
      input.value = value;
      onAdd();
      input.value = "";
      close();
    });

    dropdownControls.push({ input, dropdown, close });
  }

  function loadSettings() {
    storage.getSettings().then(renderSettings);
  }

  function renderSettings(settings) {
    currentSettings = settings;

    el.statusAutoSkip.textContent = settings.autoSkipEnabled ? "On" : "Off";
    el.statusAutoSkip.classList.toggle(
      "is-off",
      !settings.autoSkipEnabled
    );
    el.toggleAutoSkip.setAttribute(
      "aria-checked",
      settings.autoSkipEnabled ? "true" : "false"
    );
    el.speedMode.value = settings.speedMode;
    updateSpeedHighlight(settings.speedMode);

    el.keyNext.textContent = settings.keymap.next;
    el.keyStop.textContent = settings.keymap.stop;

    renderCountryList(settings.blockedCountries, el.blockedList);
    renderCountryList(settings.onlyCountries, el.onlyList);
  }

  function renderCountryList(list, container) {
    container.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No countries yet.";
      container.appendChild(empty);
      return;
    }

    list.forEach((name) => {
      const chip = document.createElement("div");
      chip.className = "chip";

      const flag = document.createElement("span");
      flag.className = "chip-flag";
      flag.textContent = getCountryInitials(name);

      const label = document.createElement("span");
      label.className = "chip-name";
      label.textContent = name;

      const remove = document.createElement("button");
      remove.className = "chip-remove";
      remove.textContent = "x";
      remove.setAttribute("data-country", name);

      chip.appendChild(flag);
      chip.appendChild(label);
      chip.appendChild(remove);
      container.appendChild(chip);
    });
  }

  function addCountry(type, value) {
    const normalized = base.normalizeCountryName(value);
    if (!normalized || !currentSettings) return;

    const key = type === "only" ? "onlyCountries" : "blockedCountries";
    const next = base.normalizeCountryList(
      currentSettings[key].concat([normalized])
    );
    storage.updateSettings({ [key]: next });
  }

  function removeCountry(type, value) {
    if (!value || !currentSettings) return;
    const key = type === "only" ? "onlyCountries" : "blockedCountries";
    const next = currentSettings[key].filter(
      (name) => name.toLowerCase() !== value.toLowerCase()
    );
    storage.updateSettings({ [key]: next });
  }

  function startKeyCapture(action) {
    if (!action || !currentSettings) return;
    captureAction = action;
    el.keyHint.textContent = "Press a key to assign, or Escape to cancel.";
    el.keyHint.classList.add("active");
  }

  function stopKeyCapture() {
    captureAction = null;
    el.keyHint.classList.remove("active");
    el.keyHint.textContent = "Press a key to assign, or Escape to cancel.";
  }

  function startStatsPolling() {
    refreshStats();
    statsTimer = setInterval(refreshStats, 1000);
  }

  async function refreshStats() {
    const status = await sendToActiveTab({ type: "omeTvAssistant:getStatus" });
    if (!status || !status.running) {
      renderStats({
        peopleTalked: 0,
        skippedByYou: 0,
        skippedByOthers: 0,
        sessionTimeMs: 0,
        topChats: [],
        countryStats: {}
      });
      return;
    }

    renderStats(status.session || {});
  }

  function renderStats(stats) {
    const peopleTalked = Number(stats.peopleTalked || 0);
    const skippedByYou = Number(stats.skippedByYou || 0);
    const skippedByOthers = Number(stats.skippedByOthers || 0);

    el.statPeople.textContent = String(peopleTalked);
    el.statSkippedYou.textContent = String(skippedByYou);
    el.statSkippedOthers.textContent = String(skippedByOthers);
    el.statSessionTime.textContent = base.formatDuration(
      stats.sessionTimeMs || 0
    );

    if (el.statTotalSkips) {
      el.statTotalSkips.textContent = String(skippedByYou + skippedByOthers);
    }

    const topChat = (stats.topChats || [])[0] || null;
    if (el.statTopChatCountry) {
      el.statTopChatCountry.textContent = topChat && topChat.country
        ? topChat.country
        : "-";
    }
    if (el.statTopChatTime) {
      el.statTopChatTime.textContent = topChat
        ? base.formatDuration(topChat.durationMs || 0)
        : "0s";
    }
  }

  function updateSpeedHighlight(mode) {
    const items = document.querySelectorAll(".speed-item");
    items.forEach((item) => {
      const isActive = item.getAttribute("data-mode") === mode;
      item.classList.toggle("active", isActive);
    });
  }

  function getCountryInitials(name) {
    const parts = String(name || "")
      .replace(/[^a-zA-Z\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "--";
    const initials = parts.map((part) => part.charAt(0)).join("");
    return initials.slice(0, 2).toUpperCase();
  }

  async function openHistory() {
    if (!history || !history.getRecentDays) return;
    el.historyLayer.classList.remove("hidden");
    el.historyLayer.setAttribute("aria-hidden", "false");
    const days = await history.getRecentDays(7);
    renderHistory(days);
  }

  function closeHistory() {
    el.historyLayer.classList.add("hidden");
    el.historyLayer.setAttribute("aria-hidden", "true");
  }

  function renderHistory(days) {
    el.historyContent.innerHTML = "";
    days.forEach((day, index) => {
      const card = document.createElement("div");
      card.className = "history-day";

      const head = document.createElement("div");
      head.className = "history-day-head";

      const label = document.createElement("span");
      label.textContent = formatDayLabel(index);

      const date = document.createElement("span");
      date.textContent = day.dayKey;

      head.appendChild(label);
      head.appendChild(date);

      const metrics = document.createElement("div");
      metrics.className = "history-metrics";
      metrics.innerHTML =
        "<div>People Talked: " +
        day.peopleTalked +
        "</div><div>Skipped By You: " +
        day.skippedByYou +
        "</div><div>Skipped By Others: " +
        day.skippedByOthers +
        "</div><div>Talking Time: " +
        base.formatDuration(day.talkTimeMs || 0) +
        "</div>";

      const topSection = document.createElement("div");
      topSection.className = "history-section";
      topSection.textContent = "Top Chats";

      const topList = document.createElement("div");
      topList.className = "history-list";
      if (!day.topChats.length) {
        topList.textContent = "No chats over 4s";
      } else {
        day.topChats.slice(0, 3).forEach((chat, idx) => {
          const item = document.createElement("div");
          item.textContent =
            "#" +
            (idx + 1) +
            " " +
            (chat.country || "-") +
            " - " +
            base.formatDuration(chat.durationMs || 0);
          topList.appendChild(item);
        });
      }

      const countrySection = document.createElement("div");
      countrySection.className = "history-section";
      countrySection.textContent = "Country Frequency";

      const countryList = document.createElement("div");
      countryList.className = "history-list";
      const entries = Object.entries(day.countryCounts || {}).sort(
        (a, b) => b[1] - a[1]
      );
      if (!entries.length) {
        countryList.textContent = "No chats yet";
      } else {
        entries.slice(0, 5).forEach(([country, count]) => {
          const item = document.createElement("div");
          item.textContent = country + ": " + count;
          countryList.appendChild(item);
        });
      }

      card.appendChild(head);
      card.appendChild(metrics);
      card.appendChild(topSection);
      card.appendChild(topList);
      card.appendChild(countrySection);
      card.appendChild(countryList);
      el.historyContent.appendChild(card);
    });
  }


  function formatDayLabel(index) {
    if (index === 0) return "Today";
    if (index === 1) return "Yesterday";
    return index + " days ago";
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null);
      });
    });
  }

  async function sendToActiveTab(message) {
    const tab = await getActiveTab();
    if (!tab || tab.id == null) return null;
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    });
  }
})();
