---
"planner": minor
---

Keep ticket boards, opening, edits, Timeline and bulk actions bounded as projects grow. Skip hidden relationship badges and unnecessary cleanup jobs, and reconcile bulk actions once after saving.

The `list-tickets` and `read-tickets` command results now use `{ tickets, total, cursor, revision }` pages instead of arrays. Scripts must read `tickets` and follow non-null cursors with the same filters. Pages default to 100 tickets; stale continuations require restarting the listing.
