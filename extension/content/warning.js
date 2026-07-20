/**
 * Warning modal UI for Shadow AI Radar.
 */
(function (global) {
  const ROOT_ID = "shadow-ai-radar-root";

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    return root;
  }

  function severityClass(sev) {
    return `sar-sev-${sev || "medium"}`;
  }

  /**
   * @returns {Promise<'allow'|'cancel'|'mask'>}
   */
  function showWarning({ findings, score, level, text, strictBlock }) {
    return new Promise((resolve) => {
      const root = ensureRoot();
      root.innerHTML = "";

      const backdrop = document.createElement("div");
      backdrop.className = "sar-backdrop";

      const modal = document.createElement("div");
      modal.className = "sar-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");

      const blockSend = strictBlock !== false;
      const title = blockSend
        ? "Blocked: prompt will not be sent"
        : level === "block"
          ? "Blocked: sensitive data detected"
          : "Warning: possible private information";

      const list = findings
        .map(
          (f) =>
            `<li class="${severityClass(f.severity)}"><span class="sar-check">✓</span> <strong>${escapeHtml(
              f.label
            )}</strong> <em>${escapeHtml(f.match)}</em> <small>${escapeHtml(f.layer)}</small></li>`
        )
        .join("");

      const note = blockSend
        ? "This prompt was stopped and was not sent to the AI. Choose Cancel to keep it local, or Mask to redact secrets in the box (then review before sending again)."
        : "This information may be confidential. Sending it to an AI service can leak company or personal data.";

      const allowBtn = blockSend
        ? ""
        : `<button type="button" class="sar-btn sar-btn-allow" data-act="allow">Send Anyway</button>`;

      modal.innerHTML = `
        <div class="sar-header">
          <div class="sar-brand">Shadow AI Radar</div>
          <div class="sar-title">${title}</div>
          <div class="sar-score">Risk score: <b>${score}</b> · ${level.toUpperCase()}</div>
        </div>
        <ul class="sar-list">${list || "<li>No specific patterns listed</li>"}</ul>
        <p class="sar-note">${note}</p>
        <div class="sar-actions">
          <button type="button" class="sar-btn sar-btn-cancel" data-act="cancel">Cancel (do not send)</button>
          <button type="button" class="sar-btn sar-btn-mask" data-act="mask">Mask in box</button>
          ${allowBtn}
        </div>
      `;

      backdrop.appendChild(modal);
      root.appendChild(backdrop);

      const finish = (act) => {
        root.innerHTML = "";
        resolve(act);
      };

      modal.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => finish(btn.getAttribute("data-act")));
      });

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) finish("cancel");
      });

      const onKey = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKey, true);
          finish("cancel");
        }
      };
      document.addEventListener("keydown", onKey, true);

      // Prefer focus cancel for safety
      modal.querySelector('[data-act="cancel"]')?.focus();
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message) {
    const root = ensureRoot();
    const el = document.createElement("div");
    el.className = "sar-toast";
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  global.ShadowWarning = { showWarning, toast };
})(typeof globalThis !== "undefined" ? globalThis : window);
