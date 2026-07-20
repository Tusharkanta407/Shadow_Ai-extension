async function load() {
  const s = await send("GET_SETTINGS");
  document.getElementById("enabled").checked = s.enabled !== false;
  document.getElementById("strictBlock").checked = s.strictBlock !== false;
  document.getElementById("useAi").checked = !!s.useAi;
  document.getElementById("key").value = s.openRouterKey || "";
  document.getElementById("model").value = s.model || "openai/gpt-4o-mini";
}

function send(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (res) => resolve(res || {}));
  });
}

document.getElementById("save").addEventListener("click", async () => {
  await send("SET_SETTINGS", {
    enabled: document.getElementById("enabled").checked,
    strictBlock: document.getElementById("strictBlock").checked,
    useAi: document.getElementById("useAi").checked,
    openRouterKey: document.getElementById("key").value.trim(),
    model: document.getElementById("model").value,
  });
  document.getElementById("status").textContent = "Saved.";
  setTimeout(() => {
    document.getElementById("status").textContent = "";
  }, 1500);
});

load();
