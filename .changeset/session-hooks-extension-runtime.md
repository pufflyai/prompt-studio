---
"pstdio": patch
---

Resolve the ticket and ticket-status names for session lifecycle event payloads through the pstdio-planner extension runtime (`get-ticket` / `ticketStatus.read`) instead of the legacy ticket/status services. Resolution stays best-effort so an unavailable extension never breaks session start.
