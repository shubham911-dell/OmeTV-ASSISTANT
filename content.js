(() => {
  const base = globalThis.OmeTVAssistant;
  const storage = globalThis.OmeTVAssistantStorage;
  const CountryManager = globalThis.OmeTVAssistantCountryManager;
  const SkipEngine = globalThis.OmeTVAssistantSkipEngine;
  const Analytics = globalThis.OmeTVAssistantAnalytics;
  const Keyboard = globalThis.OmeTVAssistantKeyboard;
  const History = globalThis.OmeTVAssistantHistory;
  if (!base || !storage || !CountryManager || !SkipEngine || !Analytics || !Keyboard) {
    return;
  }

  const state = {
    settings: base.DEFAULT_SETTINGS
  };

  const countryManager = CountryManager.create();
  const analytics = Analytics.create();
  const skipEngine = SkipEngine.create({
    onCountry: handleCountry,
    onSearching: handleSearchingState
  });
  const keyboard = Keyboard.create({
    onNext: handleUserNext,
    onStop: handleUserStop
  });

  if (History && History.ensureHistory) {
    History.ensureHistory();
  }

  storage.getSettings().then(applySettings);
  storage.onSettingsChange(applySettings);

  skipEngine.start();
  keyboard.start();

  document.addEventListener("click", handleClick, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "omeTvAssistant:getStatus") {
      sendResponse({
        running: true,
        autoSkipEnabled: state.settings.autoSkipEnabled,
        speedMode: state.settings.speedMode,
        session: analytics.getSessionSnapshot()
      });
      return;
    }
    if (message.type === "omeTvAssistant:resetSession") {
      analytics.resetSession();
      sendResponse({ ok: true });
    }
  });

  function applySettings(settings) {
    state.settings = settings;
    countryManager.updateSettings(settings);
    skipEngine.updateSettings(settings);
    keyboard.updateSettings(settings);
  }

  function handleCountry(info) {
    const decision = countryManager.getDecision(info);
    const shouldAutoSkip = state.settings.autoSkipEnabled && !decision.allowed;
    const displayName = info.name || info.key || "";

    analytics.onConnect({
      country: displayName,
      blocked: shouldAutoSkip
    });

    if (shouldAutoSkip) {
      analytics.markAutoSkip();
      skipEngine.scheduleSkip();
    }
  }

  function handleSearchingState(isSearching) {
    if (isSearching) {
      analytics.onSearchStart();
    }
  }

  function handleUserNext() {
    analytics.markUserNext();
    skipEngine.clickNext();
  }

  function handleUserStop() {
    analytics.markUserStop();
    skipEngine.clickStop();
  }

  function handleClick(e) {
    if (!e.isTrusted) return;
    if (!e.target || !e.target.closest) return;

    const nextBtn = e.target.closest(
      ".buttons__button.start-button, .btn.btn-main"
    );
    if (nextBtn) {
      analytics.markUserNext();
      return;
    }

    const stopBtn = e.target.closest(".buttons__button.stop-button");
    if (stopBtn) {
      analytics.markUserStop();
    }
  }
})();
