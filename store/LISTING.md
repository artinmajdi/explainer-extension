# Chrome Web Store listing

## Name
Explainer — understand what you read

## Summary
Select text for simpler explanations with Gemini Nano or downloadable WebLLM models, examples, diagrams, and optional pictures.

## Description
Understand the passage that made you pause.

Select a word, sentence, or passage on a supported webpage and Explainer opens a floating explanation in simpler language. Explore key ideas, definitions, examples, and useful process diagrams without leaving the page.

FEATURES
• On-device Gemini Nano explanations by default, with no API key.
• Optional WebLLM model selection: compact multilingual Qwen2.5 models. Language information appears below the model picker.
• Clear setup and model-download status.
• Automatic explanations or click-to-explain mode.
• Simpler, More detail, and Show example controls.
• Pin, copy, light/dark appearance, and reading-level preferences.
• Optional pictures from Wikimedia Commons with source and license attribution.
• Site controls, keyboard shortcut, and selection context menu.

PRIVACY AND CHOICE
Nano and WebLLM process selected text on your device. WebLLM downloads model data from Hugging Face and caches it locally; those downloads disclose your IP address and requested model files to the host. There is no automatic cloud fallback. You may separately opt into the Gemini cloud API using your own key and explicit consent. Cloud mode sends selected text to Google; optional context adds nearby text. Optional image search sends an AI-generated topic to Wikimedia and loads images from Wikimedia servers. No developer analytics or saved explanation history.

GETTING STARTED
Open Settings & AI setup, choose Gemini Nano, click Set up Gemini Nano, then save. Enable access to the sites where you want explanations and reload those pages. An offline demo is available; it is clearly labeled and uses a fixed sample rather than explaining your selection.

REQUIREMENTS AND LIMITS
Requires Chrome 138 or later on supported desktop hardware. Chrome must download its local model before Nano explanations work. Model and language availability vary by device and Chrome version. This extension does not work on Chrome internal pages, the Chrome Web Store, the built-in PDF viewer, or text drawn inside images/canvas. Nano/cloud selections are limited to 24,000 characters, and the local model may require shorter passages. WebLLM requires WebGPU with shader-f16 support, an initial model download, and passages up to 1,800 characters including context. AI explanations can be incorrect; check important details.

Explainer is independent and is not affiliated with Google or Wikimedia.

## Category
Education

## Language
English

## URLs
Homepage: https://github.com/artinmajdi/explainer-extension
Support: https://github.com/artinmajdi/explainer-extension/issues
Privacy: https://github.com/artinmajdi/explainer-extension/blob/main/PRIVACY.md

## Single purpose
Explain text that a user selects on a webpage in simpler language, with related examples, definitions, diagrams, and optional explanatory pictures.

## Permission justifications
- storage: Save user preferences, site exclusions, and optional user-provided cloud API credentials. Credential storage is limited to trusted extension contexts.
- contextMenus: Provide an Explain selected text action when a user selects text.
- activeTab: Access the current page following an explicit toolbar/shortcut/context-menu action.
- scripting: Inject and register the selection detector and floating explanation UI on sites the user enables.
- offscreen: Host and script a same-origin iframe that uses Chrome's window-only built-in Prompt API or WebLLM WebGPU runtime for local explanations; the background worker routes requests.
- generativelanguage.googleapis.com: Call the Gemini API only when the user explicitly selects cloud mode, supplies a key, and consents.
- commons.wikimedia.org: Retrieve relevant image metadata only when the user enables optional picture search.
- optional HTTP/HTTPS hosts: Detect selections and show explanations on sites the user chooses. Persistent access is requested through settings or the toolbar.

## Remote code
No remotely hosted executable JavaScript or WebAssembly. WebLLM executable JS/WASM is packaged locally; only model weights, configuration and tokenizer data download from Hugging Face. The extension also uses Chrome's documented built-in model API; cloud responses and Wikimedia metadata are rendered as data, not code.

## Data disclosures to match the dashboard
Website content: selected text and optional surrounding context are processed to provide explanations; in explicitly enabled cloud mode, they are sent to Google. Optional picture topics go to Wikimedia.
Authentication information: a user-provided Gemini API key is stored locally/session-only and sent to Google for cloud authentication.
User activity: text-selection interactions trigger the disclosed explanation feature; there is no tracking or analytics.
Do not claim that the extension never handles user data or that cloud mode is always offline.

## Reviewer test instructions
1. Install on supported Chrome desktop (138+).
2. Open Settings & AI setup. Leave Gemini Nano selected, click Set up Gemini Nano, wait for the download, and save.
3. Allow one normal HTTP/HTTPS website (or all websites) and reload it.
4. Select a short English passage to see a local explanation. Try Simpler, Pin, Escape, and click-to-explain.
5. If the review device cannot run Nano, the UI must report this without cloud fallback. The labeled offline demo can exercise the popup, but is not a substitute for testing real inference.
6. Optional cloud mode needs the reviewer's own Gemini key; no developer key or test credentials are bundled. Consent is required for selected-text transmission.
7. Enable optional pictures to test Wikimedia retrieval. It may return no suitable picture.

8. For WebLLM, select a model in Settings, verify its language details, click Download & use model, then Save. On supported WebGPU hardware, select a short passage. Remove downloaded model deletes that model’s cached data.

Nano/cloud regression tests use deterministic AI doubles. Native Nano availability was checked but full Nano generation remains a manual release check. Real WebLLM download and generation were verified with both listed Qwen sizes. Small-model output quality varies; 1.5B is recommended.
