<p align="center">
  <img src="docs/brand/logo-banner.svg" alt="Shadow AI Radar" width="640" />
</p>

<h1 align="center">Shadow AI Radar</h1>

<p align="center">
  <strong>Stop sensitive prompts before they reach public AI tools.</strong><br/>
  Local-first AI Data Loss Prevention for ChatGPT and Claude.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge-0F1419?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Manifest-V3-2DD4BF?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Detection-Local%20First-5EEAD4?style=flat-square" alt="Local First" />
  <img src="https://img.shields.io/badge/Sites-ChatGPT%20%2B%20Claude-94A3B8?style=flat-square" alt="Sites" />
</p>

---

## Overview

**Shadow AI Radar** is a browser extension that intercepts prompts on popular AI chat sites, analyzes them for secrets and personal data, and warns users before anything is sent.

Employees and individuals often paste API keys, passwords, customer records, or source code into ChatGPT and Claude without realizing the risk. Shadow AI Radar adds a protection layer at the moment of send.

| Capability | Detail |
|---|---|
| Intercept | Captures prompt text from the chat box before Send / Enter |
| Detect | Regex + heuristics for keys, PII, credentials, code, and confidential phrases |
| Warn | Clear risk popup with findings and score |
| Control | **Cancel** keeps the prompt local — it is not sent to the AI site |
| Optional AI | OpenRouter classification for harder confidential-language cases |

---

## Brand

| Element | Value |
|---|---|
| Product name | **Shadow AI Radar** |
| Category | AI Data Loss Prevention (AI DLP) / Shadow AI Protection |
| Tone | Precise, calm, security-focused |
| Primary accent | Teal `#5EEAD4` |
| Surface | Deep slate `#0F1419` |
| Mark | Radar sweep + signal blip (see `docs/brand/`) |

<p align="center">
  <img src="docs/brand/logo-mark.svg" alt="Shadow AI Radar mark" width="88" />
</p>

---

## Quick start — install in the browser

### Requirements

- Chromium browser (Chrome, Edge, or Brave)
- This repository on your machine

### Install (Load unpacked)

1. Open the extensions page  
   - **Chrome:** `chrome://extensions`  
   - **Edge:** `edge://extensions`
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the extension folder:

```text
shadow ai rader/extension
```

Example full path:

```text
d:\Downloads\Downloads\shadow ai rader\extension
```

5. Confirm **Shadow AI Radar** appears in the list.  
6. Optional: pin the extension from the browser toolbar puzzle menu.

### Redeploy after code changes

1. Open `chrome://extensions`
2. Click **Reload** on Shadow AI Radar
3. Refresh ChatGPT or Claude with **F5**

> Always refresh the AI site tab after reloading the extension. Skipping this can cause `Extension context invalidated`.

---

## How it works

```text
User
  │
  ▼
ChatGPT / Claude chat box
  │
  ▼
Shadow AI Radar content script
  │  • finds textarea / contenteditable
  │  • reads prompt on Send / Enter
  │  • pauses the send event
  ▼
Local Risk Engine
  │  • API keys & tokens
  │  • email, phone, Aadhaar, PAN, cards
  │  • passwords & private keys
  │  • sensitive filenames & code hints
  ▼
Warning UI
  │
  ├─ Cancel ──────────► prompt NOT sent
  ├─ Mask in box ─────► redacted locally (not sent yet)
  └─ Send Anyway ─────► only if Block mode is off
```

---

## Using the product

1. Open [ChatGPT](https://chatgpt.com) or [Claude](https://claude.ai).
2. Paste or type a prompt.
3. Press **Send** or **Enter**.
4. If risk is found, review the warning:
   - **Cancel (do not send)** — prompt stays on your machine for that attempt
   - **Mask in box** — secrets replaced with placeholders; send again only after review
   - **Send Anyway** — available when Block send is disabled

### Toolbar popup

| Control | Purpose |
|---|---|
| Protection | Master enable / disable |
| Block send | Prevents override; Cancel keeps traffic local |
| OpenRouter AI layer | Optional secondary classifier |
| Settings | API key and model selection |

---

## Validation prompts

**Expect a warning**

```text
Our production AWS key is AKIAIOSFODNN7EXAMPLE email bob@acme.com
```

```text
email = rahul.mehta@acme-corp.in
password = Winter@2026!
phone = 9876543210
```

```text
OpenAI key sk-abcdefghijklmnopqrstuvwxyz1234567890
Aadhaar 2345 6789 0123
PAN ABCDE1234F
```

**Expect normal send**

```text
Explain how photosynthesis works in simple words.
```

---

## Optional OpenRouter layer

1. Open the extension **Settings** page.
2. Add your OpenRouter key (`sk-or-v1-...`).
3. Enable **Use OpenRouter AI layer**.
4. Select a model (default: `openai/gpt-4o-mini`).

Local detection always runs first. Remote classification is opt-in only.

---

## Optional Python engine

Mirror of the local rules for offline checks and demos.

```powershell
cd python
python detect.py "Our production AWS key is AKIAIOSFODNN7EXAMPLE"
```

Optional HTTP service:

```powershell
pip install -r requirements.txt
uvicorn server:app --reload --port 8787
```

---

## Repository layout

```text
shadow ai rader/
├── docs/brand/              Brand assets (logo mark + banner)
├── extension/               ← Load this folder in the browser
│   ├── manifest.json
│   ├── background.js
│   ├── lib/                 Detectors + risk engine
│   ├── content/             ChatGPT / Claude intercept + warning UI
│   ├── popup/
│   ├── options/
│   └── icons/
├── python/                  CLI + optional FastAPI engine
└── README.md
```

---

## Troubleshooting

| Symptom | Resolution |
|---|---|
| Warning does not appear | Reload extension, then **F5** on the AI site |
| `Extension context invalidated` | Refresh the ChatGPT/Claude tab after extension reload |
| Extension not listed | Load unpacked again and select the `extension` folder |
| Need Send Anyway | Turn off **Block send** in the popup |

---

## Privacy

- Default analysis runs **locally in the browser**
- Prompt text is sent to OpenRouter **only** when the AI layer is enabled with your key
- Choosing **Cancel** means that send attempt never leaves for ChatGPT or Claude

---

## License

Intended for personal and internal organizational use. Adapt licensing for your distribution needs.

---

<p align="center">
  <img src="docs/brand/logo-mark.svg" alt="" width="40" /><br/>
  <sub><b>Shadow AI Radar</b> — see the risk before the send.</sub>
</p>
