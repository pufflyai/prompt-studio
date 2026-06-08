---
status: "superseded"
created: "2026-03-30T15:00:00Z"
---

# Superseded: Generalized Cross-Session Follow-Up

This proposal was superseded by planner-owned workspace status automation.

The current review workflow lives in `pstdio-planner`:

1. `review-ready` creates a review session in the same workspace.
2. The review session stores `original_session_id`.
3. `changes-requested` follows up the original implementation session.
4. When all linked active workspaces are `reviewed`, the planner ticket moves
   to `In Review`.

Do not reintroduce core ticket attempt-status endpoints for this workflow.
