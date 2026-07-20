const DEFAULTS = {
  enabled: true,
  strictBlock: true, // when risk is found, do not allow Send Anyway
  useAi: false,
  openRouterKey: "",
  model: "openai/gpt-4o-mini",
  events: [],
};

async function getStore() {
  const data = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...data };
}

async function setStore(patch) {
  const cur = await getStore();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set(next);
  return next;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_SETTINGS") {
    getStore().then((s) =>
      sendResponse({
        enabled: s.enabled,
        strictBlock: s.strictBlock !== false,
        useAi: s.useAi,
        openRouterKey: s.openRouterKey,
        model: s.model,
      })
    );
    return true;
  }

  if (msg?.type === "SET_SETTINGS") {
    setStore(msg.payload || {}).then((s) => sendResponse({ ok: true, settings: s }));
    return true;
  }

  if (msg?.type === "LOG_EVENT") {
    getStore().then(async (s) => {
      const events = [{ ...(msg.payload || {}), id: crypto.randomUUID() }, ...(s.events || [])].slice(
        0,
        100
      );
      await setStore({ events });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg?.type === "GET_EVENTS") {
    getStore().then((s) => sendResponse({ events: s.events || [] }));
    return true;
  }

  if (msg?.type === "CLEAR_EVENTS") {
    setStore({ events: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "AI_CLASSIFY") {
    classifyWithOpenRouter(msg.text || "")
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ sensitive: false, error: String(err) }));
    return true;
  }

  return false;
});

async function classifyWithOpenRouter(text) {
  const s = await getStore();
  if (!s.useAi || !s.openRouterKey) {
    return { sensitive: false, skipped: true };
  }

  const system = `You are a data-loss prevention classifier for prompts sent to public AI chatbots.
Decide if the text contains private, confidential, or regulated information that should not be shared with an external AI.
Respond ONLY with compact JSON:
{"sensitive":boolean,"severity":"low"|"medium"|"high"|"critical","category":"string","reason":"short","score":0-100}
No markdown.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shadow-ai-radar.local",
      "X-Title": "Shadow AI Radar",
    },
    body: JSON.stringify({
      model: s.model || "openai/gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text.slice(0, 4000) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { sensitive: false, parseError: true };
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { sensitive: false, parseError: true };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS).then((data) => {
    chrome.storage.local.set({ ...DEFAULTS, ...data });
  });
});
