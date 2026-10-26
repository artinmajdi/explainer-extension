# Explainer Privacy Policy

Effective date: October 26, 2026

Explainer is a browser extension maintained by Artin Majdi. Its single purpose is to explain text selected on webpages in simpler language with optional learning visuals.

## On-device explanations (default)

Gemini Nano processes selected text on the user's device through Chrome's built-in Prompt API. Explainer does not transmit these selections or local explanations to the developer or a cloud AI service. Chrome manages the model download and updates. The extension does not automatically switch to cloud processing when local AI is unavailable.

## Optional Gemini cloud service

If you explicitly select the Gemini cloud engine, provide your own API key, and consent to sharing, Explainer sends selected text and explanation preferences to Google's Gemini API. If you enable surrounding context, up to 1,800 nearby characters are included. Requests go directly to Google, not through a developer-operated server. Google processes these requests under its applicable Gemini API terms and privacy policies. Depending on your Google service tier and settings, Google's retention and use rules may differ; review them before submitting sensitive text.

In automatic cloud mode, selecting text triggers a request after a brief pause. Click-to-explain mode requires clicking Explain. Password fields and editable controls are excluded, but selections elsewhere can contain personal or sensitive data. Users control what they select and share.

## Optional pictures

When picture search is enabled, an AI-generated search topic is sent to Wikimedia Commons. Images load from Wikimedia servers. Those services receive ordinary network information, such as the requesting IP address and the requested topic or image. The extension intends to send a short generic topic rather than the selected passage, but AI-generated topics can reflect the passage. Image metadata includes source and license attribution.

## Storage and retention

Settings, enabled/disabled-site preferences, and optional API credentials are stored in the browser's extension storage. API keys are session-only by default; choosing Remember stores the key locally until removed. Local extension storage is not encrypted secret storage. Storage access is restricted to trusted extension contexts. Keys are not intentionally exposed to webpages or logged.

Selections and explanations are held temporarily to display and refine the current explanation. Explainer does not maintain a saved history of them. It does not collect browsing history, analytics, advertising identifiers, or telemetry. It has no developer-operated data collection server. Closing the popup cancels its active requests; removing a key or uninstalling does not retroactively delete data already sent to an external service.

## Data use and sharing

Data is used only to provide the requested text explanations and optional visuals. The developer does not sell user data, use it for advertising, transfer it to data brokers, or use it to determine creditworthiness or lending eligibility. Data is not shared with parties other than the services explicitly described above and enabled by the user.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## User controls

Users can choose local or cloud processing, turn off pictures and surrounding context, switch to click-to-explain, pause the extension, disable individual sites, revoke site access, remove stored credentials, or uninstall. Keep pictures disabled for fully offline explanations after the local model is downloaded.

## Third-party policies

- Google privacy: https://policies.google.com/privacy
- Gemini API terms: https://ai.google.dev/gemini-api/terms
- Wikimedia privacy: https://foundation.wikimedia.org/wiki/Policy:Privacy_policy

## Contact and changes

Questions and requests can be submitted at https://github.com/artinmajdi/explainer-extension/issues. Do not include API keys, private passages, or other sensitive information in public issues. Material changes will be reflected in this policy with an updated effective date.
