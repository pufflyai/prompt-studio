---
"@pstdio/sdk": minor
"pstdio": minor
---

Add post-event refs for ticket and attempt-status lifecycle (`ticketEvents.created/statusChanged/deleted`, `attemptStatusEvents.changed`) so extensions can observe these transitions. Removes the unused `"builtin"` value from `extension_source_kind`. Hooks remain observation-only per the spec (gated operations belong on commands with middleware).
