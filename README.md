# Shadow AI Radar

Local-first **AI Data Loss Prevention (AI DLP)** Chrome extension. It watches prompts on **ChatGPT** and **Claude**, detects sensitive data (API keys, PII, passwords, source code, and more), shows a warning, and can **block send** when you click Cancel.

```
User types prompt
        ↓
Browser extension (content script)
        ↓
Read chat box text before Send
        ↓
Local risk engine (regex + heuristics)
        ↓
Warning popup
        ↓
Cancel → prompt NOT sent
Mask → redact in box (not sent yet)
Send Anyway → only if Block mode is off
```

---

## Features

- Works on **ChatGPT** (`chatgpt.com`) and **Claude** (`claude.ai`)
- **Local detection** first (privacy-friendly, fast)
- Detects: AWS/OpenAI/Google/GitHub keys, emails, phones, Aadhaar, PAN, cards, passwords, private keys, sensitive filenames, code/confidential phrases
- Warning UI: **Cancel (do not send)** / **Mask in box** / optional **Send Anyway**
- Optional **OpenRouter** AI classification layer
- Optional **Python** CLI for the same local rules offline

---

## How to install the extension in Chrome / Edge

### Requirements

- Google Chrome, Microsoft Edge, Brave, or any Chromium browser
- This project folder on your machine

### Steps

1. Open the extensions page:
   - Chrome: go to `chrome://extensions`
   - Edge: go to `edge://extensions`
2. Turn **Developer mode** **ON** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder only:

   ```text
   shadow ai rader/extension
   ```

   Full path example:

   ```text
   d:\Downloads\Downloads\shadow ai rader\extension
   ```

5. Confirm **Shadow AI Radar** appears in the extensions list.
6. (Optional) Pin it: puzzle-piece icon → pin Shadow AI Radar.

### After every code update (redeploy)

1. Go to `chrome://extensions`
2. Click **Reload** on Shadow AI Radar
3. Refresh the ChatGPT or Claude tab with **F5**

> Important: if you reload the extension but do **not** refresh the AI site tab, you may see `Extension context invalidated`. Always refresh the page after reloading the extension.

---

## How to use

1. Open [https://chatgpt.com](https://chatgpt.com) or [https://claude.ai](https://claude.ai)
2. Type or paste a prompt
3. Press **Enter** or **Send**
4. If sensitive data is found:
   - A warning appears
   - **Cancel** → prompt stays local and is **not** sent
   - **Mask in box** → secrets are redacted in the input; still not sent until you send again
   - **Send Anyway** → only if “Block send” is turned off in the popup

### Popup controls

Click the extension icon:

| Control | Meaning |
|--------|---------|
| Protection | Master on/off |
| Block send | Hides Send Anyway; Cancel keeps prompt unsent |
| Use OpenRouter AI layer | Optional second classification (needs API key) |
| Settings | OpenRouter key + model |

---

## Test examples

### Should show a warning

```text
Our production AWS key is AKIAIOSFODNN7EXAMPLE email bob@acme.com
```

```text
Login details:
email = rahul.mehta@acme-corp.in
password = Winter@2026!
phone = 9876543210
```

```text
OpenAI key sk-abcdefghijklmnopqrstuvwxyz1234567890
Google key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
```

### Should send normally (no warning)

```text
Explain how photosynthesis works in simple words.
```

---

## Optional: OpenRouter AI layer

1. Extension icon → **Settings**
2. Paste your OpenRouter API key (`sk-or-v1-...`)
3. Enable **Use OpenRouter AI layer**
4. Choose a model (default: `openai/gpt-4o-mini`)

Local regex always runs first. AI is only used as an extra check when enabled.

---

## Optional: Python local detector

Same pattern rules as the extension, for CLI testing (no browser).

```powershell
cd "d:\Downloads\Downloads\shadow ai rader\python"
python detect.py "Our production AWS key is AKIAIOSFODNN7EXAMPLE"
```

Optional API server:

```powershell
pip install -r requirements.txt
uvicorn server:app --reload --port 8787
```

Then `POST http://127.0.0.1:8787/analyze` with JSON `{ "text": "..." }`.

---

## Project structure

```text
shadow ai rader/
├── extension/                 ← Load this folder in Chrome
│   ├── manifest.json
│   ├── background.js          ← Settings, logs, OpenRouter calls
│   ├── lib/
│   │   ├── detectors.js       ← Regex / heuristics
│   │   └── risk-engine.js     ← Score + optional AI
│   ├── content/
│   │   ├── chatgpt.js         ← Intercept ChatGPT send
│   │   ├── claude.js          ← Intercept Claude send
│   │   ├── warning.js         ← Warning popup
│   │   └── overlay.css
│   ├── popup/                 ← Toolbar popup
│   ├── options/               ← Settings page
│   └── icons/
└── python/
    ├── detect.py              ← CLI detector
    ├── server.py              ← Optional FastAPI
    └── requirements.txt
```

---

## How detection works (short)

1. Content script injects into ChatGPT/Claude
2. On Send/Enter it finds the chat box (`textarea` / `contenteditable`)
3. Reads the prompt text from the DOM
4. Stops the send event temporarily
5. Runs local detectors (`detectors.js`)
6. Shows warning if anything sensitive is found
7. **Cancel** → does not release send → prompt never reaches the site

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| No warning | Reload extension + **F5** on ChatGPT/Claude |
| `Extension context invalidated` | Refresh the AI site tab after reloading the extension |
| Extension missing | Load unpacked again → select `extension` folder |
| Safe prompts blocked | Turn Protection off, or clear false-positive text |
| Want Send Anyway | Uncheck **Block send** in the popup |

---

## Privacy note

- Default path analyzes prompts **locally in the browser**
- Prompts are sent to OpenRouter **only** if you enable the AI layer and provide a key
- Cancel keeps the prompt on your machine for that send attempt

---

## License

For personal / internal use. Adjust as needed for your organization.
