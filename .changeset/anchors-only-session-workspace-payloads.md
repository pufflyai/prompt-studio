---
"@pstdio/sdk": minor
---

Session and workspace lifecycle payloads carry generic resource anchors only; drop the ticket-specific fields from the SDK types so the host stays domain-agnostic.
