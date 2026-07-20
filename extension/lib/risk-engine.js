/**
 * Risk engine: local detection first, optional OpenRouter AI layer last.
 * Rule: ANY sensitive finding → show warning. Cancel → do not send.
 *
 * Survives "Extension context invalidated" (reload extension without refreshing tab)
 * by falling back to local-only defaults.
 */
(function (global) {
  function defaultSettings() {
    return {
      enabled: true,
      strictBlock: true,
      useAi: false,
      openRouterKey: "",
      model: "openai/gpt-4o-mini",
    };
  }

  function runtimeAlive() {
    try {
      return !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  function sendMessageSafe(message) {
    return new Promise((resolve) => {
      if (!runtimeAlive()) {
        resolve(null);
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (res) => {
          // lastError is set when context died mid-call
          if (!runtimeAlive() || (chrome.runtime && chrome.runtime.lastError)) {
            resolve(null);
            return;
          }
          resolve(res ?? null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function getSettings() {
    const res = await sendMessageSafe({ type: "GET_SETTINGS" });
    return { ...defaultSettings(), ...(res || {}) };
  }

  async function analyzePrompt(text) {
    const local = global.ShadowDetectors.detectLocal(text || "");
    const settings = await getSettings();

    if (settings.enabled === false) {
      return {
        findings: [],
        score: 0,
        level: "none",
        action: "allow",
        ai: null,
        settings,
      };
    }

    let findings = [...local.findings];
    let score = local.score;
    let level = local.level;
    let ai = null;

    const needsAi =
      settings.useAi &&
      settings.openRouterKey &&
      runtimeAlive() &&
      findings.length > 0;

    if (needsAi) {
      ai = await sendMessageSafe({
        type: "AI_CLASSIFY",
        text: (text || "").slice(0, 4000),
      });
    }

    if (ai && ai.sensitive) {
      findings.push({
        id: "ai_classification",
        label: ai.category || "AI: Sensitive Business Data",
        severity: ai.severity || "high",
        match: ai.reason || "Model flagged confidential content",
        layer: "ai",
      });
      const rescored = global.ShadowDetectors.scoreFindings(findings);
      score = Math.max(score, rescored.score, ai.score || 0);
      level = score >= 70 ? "block" : score >= 35 ? "warn" : "info";
    }

    if (findings.some((f) => f.severity === "critical")) {
      level = "block";
      score = Math.max(score, 80);
    } else if (findings.length > 0 && level === "none") {
      level = "info";
    }

    const action = findings.length > 0 ? "prompt" : "allow";
    return { findings, score, level, action, ai, settings };
  }

  global.ShadowRiskEngine = { analyzePrompt, getSettings, runtimeAlive };
})(typeof globalThis !== "undefined" ? globalThis : window);
