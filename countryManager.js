(() => {
  const base = globalThis.OmeTVAssistant;
  if (!base) return;

  function createCountryManager() {
    const state = {
      blockedSet: new Set(),
      onlySet: new Set()
    };

    function normalizeList(list) {
      const normalized = base.normalizeCountryList
        ? base.normalizeCountryList(list)
        : Array.isArray(list)
          ? list
          : [];
      return new Set(normalized.map((name) => String(name || "").toLowerCase()));
    }

    function updateSettings(settings) {
      state.blockedSet = normalizeList(settings.blockedCountries || []);
      state.onlySet = normalizeList(settings.onlyCountries || []);
    }

    function hasMatch(info, set) {
      const nameKey = info.nameKey || "";
      const codeKey = info.codeKey || "";
      if (nameKey && set.has(nameKey)) return true;
      if (codeKey && set.has(codeKey)) return true;
      return false;
    }

    function getDecision(info) {
      const hasOnly = state.onlySet.size > 0;
      const inOnly = hasMatch(info, state.onlySet);
      const inBlocked = hasMatch(info, state.blockedSet);

      if (hasOnly) {
        return {
          allowed: inOnly,
          reason: inOnly ? "only" : "not-only",
          rule: "only"
        };
      }

      if (inBlocked) {
        return {
          allowed: false,
          reason: "blocked",
          rule: "blocked"
        };
      }

      return {
        allowed: true,
        reason: "allow",
        rule: "none"
      };
    }

    return {
      updateSettings,
      getDecision
    };
  }

  globalThis.OmeTVAssistantCountryManager = {
    create: createCountryManager
  };
})();
