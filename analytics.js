(() => {
  const base = globalThis.OmeTVAssistant;
  const history = globalThis.OmeTVAssistantHistory;
  if (!base || !history) return;

  const CHAT_THRESHOLD_MS = 4000;

  function createAnalytics() {
    const state = {
      session: buildEmptySession(),
      currentChat: null
    };

    function buildEmptySession() {
      return {
        peopleTalked: 0,
        skippedByYou: 0,
        skippedByOthers: 0,
        talkTimeMs: 0,
        topChats: [],
        countryCounts: {}
      };
    }

    function now() {
      return Date.now();
    }

    function resetSession() {
      state.session = buildEmptySession();
      state.currentChat = null;
    }

    function onConnect({ country, blocked }) {
      finalizeChat("switch");
      state.currentChat = {
        country: country || "",
        blocked: Boolean(blocked),
        startedAt: now(),
        userNext: false,
        userStop: false,
        autoSkip: false
      };
    }

    function onSearchStart() {
      finalizeChat("search");
    }

    function markUserNext() {
      if (!state.currentChat) return;
      state.currentChat.userNext = true;
    }

    function markUserStop() {
      if (!state.currentChat) return;
      state.currentChat.userStop = true;
    }

    function markAutoSkip() {
      if (!state.currentChat) return;
      state.currentChat.autoSkip = true;
    }

    function getSessionTimeMs() {
      let total = state.session.talkTimeMs;
      if (state.currentChat && !state.currentChat.blocked) {
        const duration = now() - state.currentChat.startedAt;
        if (duration > CHAT_THRESHOLD_MS) {
          total += duration - CHAT_THRESHOLD_MS;
        }
      }
      return total;
    }

    function getSessionSnapshot() {
      return {
        peopleTalked: state.session.peopleTalked,
        skippedByYou: state.session.skippedByYou,
        skippedByOthers: state.session.skippedByOthers,
        sessionTimeMs: getSessionTimeMs(),
        topChats: state.session.topChats.slice(0, 3),
        countryStats: Object.assign({}, state.session.countryCounts)
      };
    }

    function updateTopChats(entry) {
      const list = state.session.topChats.slice();
      list.push(entry);
      list.sort((a, b) => b.durationMs - a.durationMs);
      state.session.topChats = list.slice(0, 3);
    }

    function updateCountryCount(country) {
      if (!country) return;
      const current = state.session.countryCounts[country] || 0;
      state.session.countryCounts[country] = current + 1;
    }

    function finalizeChat(reason) {
      const chat = state.currentChat;
      if (!chat) return;
      state.currentChat = null;

      if (chat.blocked || chat.autoSkip) {
        return;
      }

      const durationMs = Math.max(0, now() - chat.startedAt);

      if (durationMs <= CHAT_THRESHOLD_MS) {
        if (chat.userNext) {
          state.session.skippedByYou += 1;
          history.recordChat({
            endedAt: now(),
            durationMs,
            country: chat.country,
            outcome: "skippedByYou"
          });
        } else if (!chat.userStop) {
          state.session.skippedByOthers += 1;
          history.recordChat({
            endedAt: now(),
            durationMs,
            country: chat.country,
            outcome: "skippedByOthers"
          });
        }
        return;
      }

      state.session.peopleTalked += 1;
      const talkTime = durationMs - CHAT_THRESHOLD_MS;
      state.session.talkTimeMs += talkTime;

      updateCountryCount(chat.country);
      updateTopChats({ country: chat.country || "-", durationMs });

      history.recordChat({
        endedAt: now(),
        durationMs,
        country: chat.country,
        outcome: "talked"
      });
    }

    resetSession();

    return {
      resetSession,
      onConnect,
      onSearchStart,
      markUserNext,
      markUserStop,
      markAutoSkip,
      getSessionSnapshot
    };
  }

  globalThis.OmeTVAssistantAnalytics = {
    create: createAnalytics
  };
})();
