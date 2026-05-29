(() => {
  const base = globalThis.OmeTVAssistant || {};
  const DEFAULTS = base.DEFAULT_SETTINGS || {
    autoSkipEnabled: true,
    speedMode: "instant",
    blockedCountries: [],
    onlyCountries: [],
    keymap: {
      next: "ArrowRight",
      stop: "ArrowLeft"
    }
  };

  function sanitizeSettings(raw) {
    const settings = Object.assign({}, DEFAULTS, raw || {});
    settings.blockedCountries = base.normalizeCountryList
      ? base.normalizeCountryList(settings.blockedCountries)
      : settings.blockedCountries || [];
    settings.onlyCountries = base.normalizeCountryList
      ? base.normalizeCountryList(settings.onlyCountries)
      : settings.onlyCountries || [];

    settings.keymap = Object.assign({}, DEFAULTS.keymap, settings.keymap || {});
    const allowed = base.ALLOWED_KEYS || [];
    if (!allowed.includes(settings.keymap.next)) {
      settings.keymap.next = DEFAULTS.keymap.next;
    }
    if (!allowed.includes(settings.keymap.stop)) {
      settings.keymap.stop = DEFAULTS.keymap.stop;
    }

    if (!base.SPEED_DELAYS || !base.SPEED_DELAYS[settings.speedMode]) {
      settings.speedMode = DEFAULTS.speedMode;
    }

    settings.autoSkipEnabled = Boolean(settings.autoSkipEnabled);
    return settings;
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ settings: DEFAULTS }, (result) => {
        resolve(sanitizeSettings(result.settings));
      });
    });
  }

  function setSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings: sanitizeSettings(settings) }, () => {
        resolve();
      });
    });
  }

  function updateSettings(patch) {
    return getSettings().then((current) => {
      const next = Object.assign({}, current, patch || {});
      return setSettings(next);
    });
  }

  function onSettingsChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (!changes.settings) return;
      callback(sanitizeSettings(changes.settings.newValue));
    });
  }

  globalThis.OmeTVAssistantStorage = {
    getSettings,
    setSettings,
    updateSettings,
    onSettingsChange
  };
})();
