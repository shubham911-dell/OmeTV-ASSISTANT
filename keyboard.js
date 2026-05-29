(() => {
  const base = globalThis.OmeTVAssistant;
  if (!base) return;

  function createKeyboardController(options) {
    let settings = base.DEFAULT_SETTINGS;

    function updateSettings(next) {
      settings = next;
    }

    function start() {
      document.addEventListener("keydown", handleKeydown, true);
    }

    function stop() {
      document.removeEventListener("keydown", handleKeydown, true);
    }

    function isEditableTarget(target) {
      if (!target) return false;
      if (target.isContentEditable) return true;
      if (target.closest) {
        const hit = target.closest(
          "input, textarea, [contenteditable='true'], #chat-text"
        );
        if (hit) return true;
      }
      const tag = target.tagName ? target.tagName.toLowerCase() : "";
      return tag === "input" || tag === "textarea";
    }

    function handleKeydown(e) {
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const keymap = settings.keymap || {};
      if (e.key === keymap.next) {
        e.preventDefault();
        if (options.onNext) options.onNext();
        return;
      }
      if (e.key === keymap.stop) {
        e.preventDefault();
        if (options.onStop) options.onStop();
      }
    }

    return {
      start,
      stop,
      updateSettings,
      isEditableTarget
    };
  }

  globalThis.OmeTVAssistantKeyboard = {
    create: createKeyboardController
  };
})();
