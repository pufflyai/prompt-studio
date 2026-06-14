---
"pstdio": patch
---

Harness selector: new session drafts start from the last explicitly selected agent/model instead of the project defaults, and the selection no longer resets to the default model after the first message (view refreshes only adopt fields the backend actually changed, and an unknown model list no longer clobbers an explicit pick).
