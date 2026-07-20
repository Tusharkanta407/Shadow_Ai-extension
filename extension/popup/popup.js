async function load() {
  const settings = await send("GET_SETTINGS");
  const { events } = await send("GET_EVENTS");

  document.getElementById("enabled").checked = settings.enabled !== false;
  document.getElementById("strictBlock").checked = settings.strictBlock !== false;
  document.getElementById("useAi").checked = !!settings.useAi;

  const list = events || [];
  document.getElementById("count").textContent = String(list.length);
  document.getElementById("blocked").textContent = String(
    list.filter((e) => e.decision === "cancelled" || e.decision === "masked").length
  );

  const ul = document.getElementById("events");
  if (!list.length) {
    ul.innerHTML = '<li class="empty">No events yet — open ChatGPT and try a risky prompt</li>';
    return;
  }

  ul.innerHTML = list
    .slice(0, 20)
    .map((e) => {
      const when = new Date(e.at || Date.now()).toLocaleTimeString();
      return `<li>
        <div><strong>${escapeHtml(e.site || "?")}</strong> · ${escapeHtml(e.decision || "")} · score ${e.score ?? "?"}</div>
        <div class="meta">${when} · ${(e.findings || []).join(", ") || "none"}</div>
        <div class="meta">${escapeHtml(e.preview || "")}</div>
      </li>`;
    })
    .join("");
}

function send(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (res) => resolve(res || {}));
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.getElementById("enabled").addEventListener("change", async (e) => {
  await send("SET_SETTINGS", { enabled: e.target.checked });
});

document.getElementById("strictBlock").addEventListener("change", async (e) => {
  await send("SET_SETTINGS", { strictBlock: e.target.checked });
});

document.getElementById("useAi").addEventListener("change", async (e) => {
  await send("SET_SETTINGS", { useAi: e.target.checked });
});

document.getElementById("clear").addEventListener("click", async () => {
  await send("CLEAR_EVENTS");
  load();
});

document.getElementById("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

load();
