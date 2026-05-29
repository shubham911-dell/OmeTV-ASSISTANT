importScripts("settings.js", "storage.js", "history.js");

async function ensureDefaults() {
  const settings = await OmeTVAssistantStorage.getSettings();
  await OmeTVAssistantStorage.setSettings(settings);
  if (globalThis.OmeTVAssistantHistory) {
    await globalThis.OmeTVAssistantHistory.ensureHistory();
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults();
});
