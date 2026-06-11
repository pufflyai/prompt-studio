---
"@pstdio/sdk": minor
---

Replace the thin HarnessProvider with a transport-neutral lifecycle contract (capabilities/detect/listModels/start/resume/reattach/getMessages with an injected event sink and approval channel) and re-export the harness data contract types from @pstdio/sdk/extensions. The agents client shrinks to info/models (config setup/update/remove endpoints no longer exist).
