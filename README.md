# Explainer

Select a passage. Understand it in plain language without leaving the page.

Explainer is a Manifest V3 Chrome extension with a floating reading companion, on-device Gemini Nano or WebLLM explanations, examples, definitions, locally rendered process diagrams, and optional Wikimedia pictures.

## Install the built extension

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this project's **dist** folder.
4. Pin Explainer using Chrome's extensions menu.
5. Open **Settings & AI setup** from the Explainer toolbar menu.
6. Leave **Gemini Nano · on this device** selected. Click **Set up Gemini Nano**, keep Settings open until Chrome finishes downloading the model, and save. No API key or cloud consent is required.
7. Reload already-open webpages once after installation/update, then select text on an ordinary website. Automatic website access is included at installation; no right-click or per-site activation is required. Chrome may require you to approve expanded access when updating from 1.2.0.
8. Select a word or passage. The explanation opens after a short pause.

The ZIP in `artifacts/explainer-1.2.0.zip` contains the same built extension. Extract it before using Load unpacked. This is not a Chrome Web Store installation or signed CRX.

### Offline demonstration (optional)

Enable **Try offline demo mode**, save, and select text on an ordinary page. The demo always shows a clearly labeled sample about photosynthesis, **not an explanation of the selected passage**. It makes no AI or image-search requests.

### Controls

- **Automatically after selection** or **When I click “Explain”** in Settings.
- **Alt+Shift+E** (Option+Shift+E on macOS), or the selection toolbar, explains text on demand. Chrome shortcuts can be changed at `chrome://extensions/shortcuts`.
- **Pin** keeps the current explanation while you read or select other text; **Escape** always closes it.
- **Simpler**, **More detail**, and **Show example** make a fresh request about the original selection.
- **Copy** copies the explanation as plain text. Clipboard access can be blocked by the page/browser; a failure is shown without disrupting the explanation.
- Pause everywhere, disable a hostname, or edit the disabled-sites list.
- Choose reading level, explanation language, and light/dark/system popup appearance.

## Gemini Nano setup and compatibility

Version 1.1 makes **Gemini Nano** the default, including when upgrading settings from version 1.0. Existing cloud credentials stay stored, but are not used unless you explicitly select **Gemini cloud** and save. Demo mode remains an independent setting; disable it for real explanations.

Chrome 138+ is required; use an up-to-date desktop Chrome. The settings screen checks the real `LanguageModel.availability()` result for your selected output language. Available, downloadable, downloading, unsupported, and failed setup states are shown explicitly. The initial download starts from your click on **Set up Gemini Nano**. You can cancel setup; Chrome may retain downloaded model data. Chrome manages model updates, availability, and removal.

Google documents at least 22 GB free profile-disk space for eligibility (the model is smaller), and either a supported GPU with more than 4 GB VRAM or at least 16 GB RAM and four CPU cores. Other restrictions include operating system, language, and network conditions for the initial download. See [Chrome’s current requirements](https://developer.chrome.com/docs/ai/prompt-api#hardware-requirements). Chrome on Android/iOS is not supported. Built-in AI availability in other Chromium browsers is not guaranteed; this integration targets Chrome’s Gemini Nano.

There is **no automatic cloud fallback**. If Nano cannot run, the popup explains the problem and offers Settings. Local explanations and diagrams work offline after setup. Optional Wikimedia pictures still use the internet.

## Privacy and credentials

The default Nano engine needs no API key. For the optional cloud engine, users provide their own Gemini key; provider charges and quotas may apply. The configurable default is `gemini-2.5-flash-lite`. A replacement must support `generateContent` and structured JSON responses.

Keys are stored in `chrome.storage.session` by default. This clears when the browser session ends. Explicitly choosing **Remember my key on this device** uses extension-local storage, which is **not encrypted secret storage**. Both storage areas are restricted to trusted extension contexts. Keys are never sent to content scripts, placed in the webpage DOM, returned by status messages, or logged by the extension. Remove the key from Settings at any time. A future hosted public service should keep shared provider credentials on an authenticated, rate-limited backend.

Cloud AI requests require explicit provider selection and consent. In cloud automatic mode, each settled selection sends its text to Google’s Gemini API. With Nano or WebLLM, selections are processed locally. Optional surrounding context adds up to 1,800 characters from its enclosing paragraph, list item, or article to the selected engine. Use click mode or pause the extension on private pages. Password fields, textareas, and editable elements are excluded.

Optional picture search sends a short AI-generated generic topic to Wikimedia Commons. Images load from Wikimedia's servers and display source/author/license metadata. Google and Wikimedia may handle their requests according to their own policies. Explainer does not store selections, explanation history, or browsing history and includes no analytics. Page UI is isolated by Shadow DOM for styling; it is **not** a security boundary against a hostile webpage.

## Permissions

- `activeTab`: temporary current-tab access after a toolbar or keyboard-shortcut invocation. Added in 1.2.3 at user request; it is redundant while broad website access is granted and does not remove the broad-host review warning.

- `offscreen`: hosts and scripts a same-origin extension iframe for the window-only Prompt API and WebLLM runtime, independently of the webpage.
- `storage`: settings and optional user-provided cloud credentials.
- Required HTTP/HTTPS host access: detects selections automatically on ordinary websites and displays explanations. Also permits the optional Gemini cloud and Wikimedia requests. No `contextMenus` or `scripting` permission is used. Declarative content scripts start automatically when pages load.

Removing persistent website permissions prevents future automatic injections. Reload existing tabs to remove scripts already injected. Pausing the extension immediately closes its current popups and prevents new explanations.

## Limits and compatibility

- Works with DOM-selectable text on permitted ordinary HTTP/HTTPS pages. Handles single words, multiple paragraphs, dynamic content, and permitted frames.
- Does not support `chrome://` pages, the Chrome Web Store, the built-in PDF viewer, text inside images/canvas, closed shadow roots, or frames without permission. File URLs are not requested.
- Keyboard/toolbar activation targets the top frame. Use automatic selection or the toolbar for a permitted iframe.
- Nano/cloud: up to **24,000 characters** per selection. Oversize input is rejected before sending. Selections are split at whitespace into chunks of 3,000 characters for Nano or 6,000 for cloud AI, explained sequentially, and synthesized. Nano merges explanations in pairs and checks the measured context budget when Chrome exposes that API. An oversized intermediate result fails clearly instead of silently discarding content. Progress is visible. This character budget conservatively bounds input size; it is not an exact provider token count. Long passages need multiple inference passes (billable requests in cloud mode) and synthesis can lose nuance.
- Each cloud Gemini request times out after 55 seconds. Nano has a three-minute processing limit and WebLLM a five-minute limit; slow devices may need shorter selections. Browser/service-worker interruption produces a retry message. No requests survive a browser restart.
- Pictures depend on Commons availability and relevance; a relevant picture is not guaranteed. Diagrams are generated only for an appropriate process or causal chain. Pictures load separately from the explanation.
- Selection inside an iframe is displayed within that frame and is limited by its viewport.
- Some fullscreen/top-layer page interfaces, deeply transformed roots, unusual custom selections, and strict page image policies can limit display or images.
- AI output can be wrong. Verify important details against the original source.

## Development

Requires Node.js 22+ and npm.

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run package
```

`npm run dev` watches TypeScript changes. Reload the extension in Chrome after builds, then reload test webpages. Public assets are copied at build/watch startup; restart the watcher after changing public assets.

### Architecture

- `src/content.ts`: selection capture, isolated popup, accessible controls, request lifecycle, safe DOM rendering, and visual layout.
- `src/background.ts`: trusted storage, settings, site registration, validated messaging, provider orchestration, cancellation, and image search.
- `src/nano.ts`: local Prompt API availability, user-triggered setup/download, constrained JSON generation, context checks, session cleanup, and local chunk processing.
- `src/nano-bridge.ts` / `src/offscreen.ts` / `src/nano-frame.ts`: background-to-document routing and cancellable local inference in a same-origin iframe.
- `src/provider.ts`: Gemini REST integration, structured response schema, explanation instructions, and long-text processing.
- `src/core.ts`: shared types, validation, limits, and positioning.
- `src/options.ts` / `src/popup.ts`: setup and toolbar controls.
- `public/`: manifest, HTML, CSS, and bundled icons.

All executable code is bundled locally. The CSP allows bundled WebAssembly compilation for WebLLM but does not allow JavaScript unsafe-eval or remote scripts. There is no model-generated HTML execution or arbitrary-URL fetch proxy. Explanations and Commons metadata are inserted as text. Process diagrams are built from a bounded list of validated labels and details.

## Validation

Unit tests exercise chunk preservation, input limits, response validation, model restrictions, URL restrictions, positioning, provider errors, and multi-part synthesis.

Browser tests load the **built extension** into an isolated Chromium profile. Tests retain production website permissions and verify automatic selection without toolbar or toolbar activation. A test-only Prompt API double is injected into the temporary local-AI iframe; this file is never included in the production build. Deterministic responses replace fetch at the service-worker network boundary. Tests cover default-provider migration, Nano setup, local routing without a key, no network/cloud fallback, unavailable/download-required states, setup, demo labeling, CSS isolation, pinning, Gemini request construction, image failure, refinement, inert malicious markup, stale requests, rate limits, input size, editable exclusions, narrow viewports, click mode, frames, and pause.

Screenshots are saved to `artifacts/settings.png` and `artifacts/extension-demo.png`. A successful run writes `artifacts/test-report.json`.

Native Gemini Nano generation requires a supported Chrome installation with a downloaded model and is not confirmed by mocked tests. Use **Set up Gemini Nano**, then explain a short passage to check your installation. Cloud generation has not been verified without a user-provided key; use **Test saved connection** if you opt into that engine. Headless tests do not exercise Chrome's native permission prompts, toolbar UI, or physical keyboard shortcut dispatch; verify those manually after installation.

## Reference

Inspired by the learning interactions publicly shown in [Google Learn About](https://learning.google.com/experiments/learn-about/signup). The signed-in selection interaction was not accessible during research. Explainer has its own design and is not affiliated with Google.

## Privacy and publishing

See [PRIVACY.md](PRIVACY.md) for data handling and [store/LISTING.md](store/LISTING.md) for the store description, permission explanations, and reviewer instructions.


## WebLLM: choose another local model (v1.2)

In Settings, select **WebLLM**, choose a model, click **Download & use model**, then **Save settings**. Language information updates immediately below the model picker, with a link to the author's model card. No API key or desktop app is required. Downloads are several hundred MB to around 1 GB; allow time for the first download and GPU compilation.

Included models: Qwen2.5 0.5B and 1.5B Instruct (multilingual). Qwen's authors report 29+ languages; the UI lists their explicitly named examples and does not promise unverified Persian support. Small models can be inaccurate, especially outside their strongest languages.

WebLLM needs WebGPU with shader-f16 support. Models use roughly 0.95–1.63 GB of GPU memory plus browser overhead. This release limits WebLLM selections plus context to 1,800 characters for the packaged 4K context model libraries. Nano and cloud retain their existing passage handling. If local processing fails there is no automatic cloud fallback.

Use **Remove downloaded model** to delete the selected model's cached files. Model data downloads from Hugging Face; all executable JS/WASM ships in the extension. The WASM source URLs and SHA-256 hashes are recorded in `public/models/sources.json`. Rebuilds do not download executable libraries. See `public/models/NOTICE.txt` for third-party notices.

Validation: `node tests/webllm-browser.mjs` checks model selection, language descriptions, persistence, actual WebLLM loading, and GPU availability. Set `WEBLLM_REAL_TEST=1` to also download Qwen2.5 1.5B and generate an explanation in an isolated browser profile.

Release validation for 1.2.0: 16 unit tests and 21 Nano/cloud browser regression checks passed. Both Qwen sizes downloaded and generated real local explanations on the development machine. The 0.5B test also verified webpage selection through the background/offscreen path, cached model reload with networking disabled, and cache deletion while offline. This confirms the integration, not the factual accuracy of every generated explanation or support on every GPU.
