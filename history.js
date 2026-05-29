(() => {
  const STORAGE_KEY = "omeTvAssistantHistory";
  const MAX_DAYS = 7;
  const CHAT_THRESHOLD_MS = 4000;

  function now() {
    return Date.now();
  }

  function getDayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function getDayKeyFromTs(ts) {
    return getDayKey(new Date(ts));
  }

  function startOfDayMs(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function buildEmptyDay(dayKey) {
    return {
      dayKey,
      peopleTalked: 0,
      skippedByYou: 0,
      skippedByOthers: 0,
      topChats: [],
      countryCounts: {},
      talkTimeMs: 0
    };
  }

  function normalizeHistory(raw) {
    const safe = raw && typeof raw === "object" ? raw : {};
    return {
      lastResetAt: Number(safe.lastResetAt) || 0,
      days: safe.days && typeof safe.days === "object" ? safe.days : {}
    };
  }

  function isSameDay(a, b) {
    if (!a || !b) return false;
    const da = new Date(a);
    const db = new Date(b);
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  }

  function pruneHistory(history) {
    const keys = Object.keys(history.days || {}).sort((a, b) =>
      b.localeCompare(a)
    );
    const keep = new Set(keys.slice(0, MAX_DAYS));
    for (const key of keys) {
      if (!keep.has(key)) delete history.days[key];
    }
  }

  function getLastNDaysKeys(count) {
    const out = [];
    const base = new Date();
    for (let i = 0; i < count; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      out.push(getDayKey(d));
    }
    return out;
  }

  function updateTopChats(list, entry) {
    const next = Array.isArray(list) ? list.slice() : [];
    next.push(entry);
    next.sort((a, b) => b.durationMs - a.durationMs);
    return next.slice(0, 3);
  }

  function getHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [STORAGE_KEY]: {} }, (result) => {
        resolve(normalizeHistory(result[STORAGE_KEY]));
      });
    });
  }

  function setHistory(history) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
        resolve();
      });
    });
  }

  async function ensureHistory() {
    const history = await getHistory();
    const todayKey = getDayKey();
    if (!history.days[todayKey]) {
      history.days[todayKey] = buildEmptyDay(todayKey);
    }
    if (!isSameDay(history.lastResetAt, now())) {
      history.lastResetAt = startOfDayMs(new Date());
    }
    pruneHistory(history);
    await setHistory(history);
    return history;
  }

  async function recordChat(entry) {
    if (!entry || !entry.endedAt) return;
    const history = await getHistory();
    const dayKey = getDayKeyFromTs(entry.endedAt);
    const day = history.days[dayKey] || buildEmptyDay(dayKey);

    if (entry.outcome === "talked") {
      day.peopleTalked += 1;
      day.talkTimeMs += Math.max(0, entry.durationMs - CHAT_THRESHOLD_MS);

      if (entry.country) {
        const count = day.countryCounts[entry.country] || 0;
        day.countryCounts[entry.country] = count + 1;
      }

      if (entry.durationMs > CHAT_THRESHOLD_MS) {
        day.topChats = updateTopChats(day.topChats, {
          country: entry.country || "-",
          durationMs: entry.durationMs
        });
      }
    } else if (entry.outcome === "skippedByYou") {
      day.skippedByYou += 1;
    } else if (entry.outcome === "skippedByOthers") {
      day.skippedByOthers += 1;
    }

    history.days[dayKey] = day;
    history.lastResetAt = startOfDayMs(new Date(entry.endedAt));
    pruneHistory(history);
    await setHistory(history);
  }

  async function getRecentDays(count = MAX_DAYS) {
    const history = await getHistory();
    const keys = getLastNDaysKeys(count);
    return keys.map((key) => history.days[key] || buildEmptyDay(key));
  }

  globalThis.OmeTVAssistantHistory = {
    ensureHistory,
    recordChat,
    getHistory,
    getRecentDays
  };
})();
