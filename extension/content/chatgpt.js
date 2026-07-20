/**
 * ChatGPT — intercept Send/Enter BEFORE the site handles it.
 *
 * Flow:
 * 1) Sensitive text → show warning
 * 2) Cancel → prompt is NOT sent
 * 3) Safe text / Send Anyway → then allow send
 */
(function () {
  const STATE = { bypassOnce: false, pending: false };

  function findComposer() {
    const selectors = [
      "#prompt-textarea",
      'div[contenteditable="true"]#prompt-textarea',
      "div.ProseMirror[contenteditable='true']",
      'textarea[name="prompt-textarea"]',
      "form textarea",
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
    ];
    for (const sel of selectors) {
      const nodes = [...document.querySelectorAll(sel)].filter(isVisible);
      if (nodes.length) return nodes[nodes.length - 1];
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = window.getComputedStyle(el);
    return (
      r.width > 20 &&
      r.height > 8 &&
      st.visibility !== "hidden" &&
      st.display !== "none"
    );
  }

  function readText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return (el.value || "").trim();
    return (el.innerText || el.textContent || "").trim();
  }

  function writeText(el, text) {
    if (!el) return;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = window.HTMLTextAreaElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    el.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
  }

  function findSendButton() {
    const list = [
      ...document.querySelectorAll('button[data-testid="send-button"]'),
      ...document.querySelectorAll('button[aria-label*="Send" i]'),
      ...document.querySelectorAll('button[aria-label*="send" i]'),
      ...document.querySelectorAll("form button[type='submit']"),
    ];
    return list.find((b) => isVisible(b) && !b.disabled) || null;
  }

  function isSendButton(el) {
    if (!el || el.tagName !== "BUTTON") return false;
    const testId = el.getAttribute("data-testid") || "";
    const label = el.getAttribute("aria-label") || "";
    if (testId === "send-button") return true;
    if (/send/i.test(label)) return true;
    if (el.type === "submit" && el.closest("form") && findComposer()) return true;
    return false;
  }

  function stopEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function allowSendNow() {
    STATE.bypassOnce = true;
    setTimeout(() => {
      const btn = findSendButton();
      if (btn) {
        btn.click();
        return;
      }
      const c = findComposer();
      if (!c) return;
      c.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    }, 50);
  }

  async function handleGate() {
    if (STATE.pending) return;
    STATE.pending = true;

    try {
      // Extension was reloaded — old script is dead until page refresh
      if (typeof ShadowRiskEngine !== "undefined" && ShadowRiskEngine.runtimeAlive && !ShadowRiskEngine.runtimeAlive()) {
        ShadowWarning.toast("Extension reloaded — refresh this page (F5)");
        return;
      }

      const text = readText(findComposer());
      if (!text) {
        allowSendNow();
        return;
      }

      // Instant local check so warning always appears for secrets/PII
      const quick = ShadowDetectors.detectLocal(text);
      let result;
      if (quick.findings.length > 0) {
        let settings = { strictBlock: true, enabled: true };
        try {
          settings = await ShadowRiskEngine.getSettings();
        } catch (_) {}

        if (settings.enabled === false) {
          allowSendNow();
          return;
        }

        result = {
          findings: quick.findings,
          score: quick.score,
          level: quick.level === "none" ? "warn" : quick.level,
          settings,
        };
      } else {
        result = await ShadowRiskEngine.analyzePrompt(text);
        if (result.action === "allow" || !result.findings.length) {
          logEvent(text, result, "allowed_auto");
          allowSendNow();
          return;
        }
      }

      const strictBlock = result.settings?.strictBlock !== false;
      const choice = await ShadowWarning.showWarning({
        findings: result.findings,
        score: result.score,
        level: result.level || "warn",
        text,
        strictBlock,
      });

      // CANCEL = do not send to ChatGPT
      if (choice === "cancel") {
        logEvent(text, result, "cancelled");
        ShadowWarning.toast("Cancelled — prompt was NOT sent");
        return;
      }

      if (choice === "mask") {
        writeText(findComposer(), ShadowDetectors.maskSensitive(text));
        logEvent(text, result, "masked");
        ShadowWarning.toast("Masked in box — NOT sent yet");
        return;
      }

      if (strictBlock) {
        logEvent(text, result, "cancelled");
        ShadowWarning.toast("Blocked — prompt was NOT sent");
        return;
      }

      logEvent(text, result, "allowed_override");
      allowSendNow();
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/Extension context invalidated/i.test(msg)) {
        ShadowWarning.toast("Extension reloaded — refresh this page (F5)");
        return;
      }
      console.error("[Shadow AI Radar]", err);
      ShadowWarning.toast("Radar error — send blocked for safety");
    } finally {
      STATE.pending = false;
    }
  }

  function logEvent(text, result, decision) {
    try {
      if (!chrome?.runtime?.id) return;
      chrome.runtime.sendMessage({
        type: "LOG_EVENT",
        payload: {
          site: "chatgpt",
          decision,
          score: result.score,
          level: result.level,
          findings: (result.findings || []).map((f) => f.id),
          preview: text.slice(0, 80),
          at: Date.now(),
        },
      });
    } catch (_) {}
  }

  function shouldBypass() {
    if (!STATE.bypassOnce) return false;
    STATE.bypassOnce = false;
    return true;
  }

  function onKeydown(e) {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.repeat) return;
    const composer = findComposer();
    if (!composer) return;
    if (e.target !== composer && !composer.contains(e.target)) return;
    if (shouldBypass()) return;

    stopEvent(e);
    handleGate();
  }

  function onPointerOrClick(e) {
    const btn = e.target?.closest?.("button");
    if (!isSendButton(btn)) return;
    if (shouldBypass()) return;

    stopEvent(e);
    handleGate();
  }

  function onSubmit(e) {
    if (shouldBypass()) return;
    if (!findComposer()) return;
    stopEvent(e);
    handleGate();
  }

  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("click", onPointerOrClick, true);
  document.addEventListener("pointerdown", onPointerOrClick, true);
  document.addEventListener("submit", onSubmit, true);

  console.info("[Shadow AI Radar] ChatGPT ready — sensitive → warning, Cancel → not sent");
})();
