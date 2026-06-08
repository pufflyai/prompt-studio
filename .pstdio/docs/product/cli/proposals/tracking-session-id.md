---
status: "superseded"
created: "2026-04-03T12:00:00Z"
---

# Superseded: Track Which Session Invoked Which pstdio CLI Command

This proposal was superseded by planner-owned workspace status automation.

Core `pst workspaces set-status` and attempt-status events were removed. Planner
stores workspace review status and correlates review sessions back to the
original implementation session through planner metadata and
`original_session_id`.

Do not rebuild the old core attempt-status session-correlation path. New ticket
workflow automation should live in `pstdio-planner`.
