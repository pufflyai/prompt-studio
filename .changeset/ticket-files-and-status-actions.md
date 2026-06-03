---
"pstdio-core-tickets": minor
"@pstdio/ui": patch
---

Tickets: add multiple editable files per ticket, shown in a Files tree in the main-left panel beside the editor (create/delete/select, with file selection coordinated over the extension command feed), and make the per-status board actions (create ticket / drag in / drag out / archive all) configurable from the ticket status settings. `TagSettingsPanel` now forwards `actionOptions`/`actionsColumnLabel` to the underlying editor.
