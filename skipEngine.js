(() => {
  const base = globalThis.OmeTVAssistant;
  if (!base) return;

  const CHAT_CONTAINER_SELECTOR = ".chat__messages";
  const COUNTRY_SELECTOR = ".connection-established-message .tr-country";
  const SEARCHING_SELECTOR = "[data-tr=\"searching\"]";

  const DEDUPE_MS = {
    normal: 360,
    fast: 220,
    instant: 120
  };

  const SKIP_COOLDOWN_MS = {
    normal: 800,
    fast: 620,
    instant: 420
  };

  const FALLBACK_INTERVAL_MS = {
    normal: 250,
    fast: 120,
    instant: 50
  };

  const NEXT_SELECTORS = [".buttons__button.start-button", ".btn.btn-main"];
  const STOP_SELECTOR = ".buttons__button.stop-button:not(.disabled)";

  function createSkipEngine(options) {
    const state = {
      settings: base.DEFAULT_SETTINGS,
      container: null,
      observer: null,
      rootObserver: null,
      fallbackId: null,
      searching: false,
      lastCountryKey: "",
      lastCountryAt: 0,
      lastSkipAt: 0,
      skipQueued: false
    };

    function now() {
      return Date.now();
    }

    function updateSettings(settings) {
      state.settings = settings;
      if (state.searching && state.fallbackId) {
        restartFallback();
      }
    }

    function start() {
      waitForContainer();
    }

    function waitForContainer() {
      const container = document.querySelector(CHAT_CONTAINER_SELECTOR);
      if (container) {
        attachContainer(container);
        return;
      }
      state.rootObserver = new MutationObserver(() => {
        const found = document.querySelector(CHAT_CONTAINER_SELECTOR);
        if (found) {
          state.rootObserver.disconnect();
          state.rootObserver = null;
          attachContainer(found);
        }
      });
      state.rootObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    function attachContainer(container) {
      if (state.container === container) return;
      detachContainer();
      state.container = container;
      state.observer = new MutationObserver(handleMutations);
      state.observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true
      });
      scanState();
    }

    function detachContainer() {
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      stopFallback();
      state.container = null;
    }

    function handleMutations(mutations) {
      let foundCountry = false;
      for (const mutation of mutations) {
        if (!mutation.addedNodes.length && !mutation.removedNodes.length) {
          continue;
        }
        for (const node of mutation.addedNodes) {
          const countryEl = findCountryFromNode(node);
          if (countryEl) {
            handleCountryElement(countryEl);
            foundCountry = true;
            break;
          }
        }
        if (foundCountry) break;
      }

      if (!foundCountry) {
        scanState();
      }
    }

    function scanState() {
      if (!ensureContainer()) return;
      updateSearchingState();
      const countryEl = state.container.querySelector(COUNTRY_SELECTOR);
      if (countryEl) {
        handleCountryElement(countryEl);
      }
    }

    function updateSearchingState() {
      const isSearching = Boolean(
        state.container && state.container.querySelector(SEARCHING_SELECTOR)
      );
      if (isSearching !== state.searching) {
        state.searching = isSearching;
        if (isSearching) {
          startFallback();
        } else {
          stopFallback();
        }
        if (options.onSearching) {
          options.onSearching(isSearching);
        }
        return;
      }

      if (state.searching && !state.fallbackId) {
        startFallback();
      }
    }

    function startFallback() {
      if (state.fallbackId) return;
      fallbackCheck();
      state.fallbackId = setInterval(() => {
        if (!state.searching) {
          stopFallback();
          return;
        }
        fallbackCheck();
      }, getFallbackInterval());
    }

    function stopFallback() {
      if (!state.fallbackId) return;
      clearInterval(state.fallbackId);
      state.fallbackId = null;
    }

    function restartFallback() {
      stopFallback();
      if (state.searching) {
        startFallback();
      }
    }

    function fallbackCheck() {
      if (!ensureContainer()) return;
      const countryEl = state.container.querySelector(COUNTRY_SELECTOR);
      if (countryEl) {
        handleCountryElement(countryEl);
      }
    }

    function ensureContainer() {
      if (state.container && document.contains(state.container)) return true;
      detachContainer();
      waitForContainer();
      return false;
    }

    function normalizeCountryKey(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^country[\s:_-]*/, "")
        .replace(/\s+/g, " ");
    }

    function readCountryInfo(el) {
      const codeRaw = el.getAttribute("data-tr") || "";
      const nameRaw = (el.textContent || "").trim();
      const name = base.normalizeCountryName
        ? base.normalizeCountryName(nameRaw)
        : nameRaw;
      const nameKey = normalizeCountryKey(name || nameRaw);
      const codeKey = normalizeCountryKey(codeRaw);
      const key = codeKey || nameKey;
      return { name, nameKey, codeKey, key };
    }

    function isDuplicate(key) {
      const t = now();
      if (key === state.lastCountryKey && t - state.lastCountryAt < getDedupeMs()) {
        return true;
      }
      state.lastCountryKey = key;
      state.lastCountryAt = t;
      return false;
    }

    function handleCountryElement(el) {
      const info = readCountryInfo(el);
      if (!info.key) return;
      if (isDuplicate(info.key)) return;

      state.searching = false;
      stopFallback();

      if (options.onCountry) {
        options.onCountry(info);
      }
    }

    function isElementDisabled(el) {
      if (!el) return true;
      if (el.hasAttribute("disabled")) return true;
      if (el.getAttribute("aria-disabled") === "true") return true;
      if (el.classList.contains("disabled")) return true;
      return false;
    }

    function clickElement(el) {
      if (!el || isElementDisabled(el)) return false;
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      el.click();
      return true;
    }

    function findFirstSelector(selectors) {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
      return null;
    }

    function clickNext() {
      const btn = findFirstSelector(NEXT_SELECTORS);
      return clickElement(btn);
    }

    function clickStop() {
      const btn = document.querySelector(STOP_SELECTOR);
      return clickElement(btn);
    }

    function scheduleSkip() {
      if (!state.settings.autoSkipEnabled) return;
      const t = now();
      if (state.skipQueued) return;
      if (t - state.lastSkipAt < getSkipCooldown()) return;

      const delay = base.SPEED_DELAYS[state.settings.speedMode] ?? 0;
      state.skipQueued = true;
      if (delay <= 0) {
        state.skipQueued = false;
        state.lastSkipAt = now();
        clickNext();
        return;
      }

      setTimeout(() => {
        state.skipQueued = false;
        if (!state.settings.autoSkipEnabled) return;
        state.lastSkipAt = now();
        clickNext();
      }, delay);
    }

    function getModeKey() {
      return state.settings.speedMode || "normal";
    }

    function getFallbackInterval() {
      return FALLBACK_INTERVAL_MS[getModeKey()] || FALLBACK_INTERVAL_MS.normal;
    }

    function getDedupeMs() {
      return DEDUPE_MS[getModeKey()] || DEDUPE_MS.normal;
    }

    function getSkipCooldown() {
      return SKIP_COOLDOWN_MS[getModeKey()] || SKIP_COOLDOWN_MS.normal;
    }

    function findCountryFromNode(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
      const el = node;
      if (el.matches && el.matches(COUNTRY_SELECTOR)) return el;
      if (el.classList && el.classList.contains("connection-established-message")) {
        const direct = el.querySelector(COUNTRY_SELECTOR);
        if (direct) return direct;
      }
      if (el.querySelector) {
        return el.querySelector(COUNTRY_SELECTOR);
      }
      return null;
    }

    return {
      start,
      updateSettings,
      scheduleSkip,
      clickNext,
      clickStop
    };
  }

  globalThis.OmeTVAssistantSkipEngine = {
    create: createSkipEngine
  };
})();
