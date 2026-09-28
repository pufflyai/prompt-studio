---
status: "superseded"
created: "2026-03-30T15:00:00Z"
---

# Superseded: generalized cross-session follow-up

Planner's managed attempt and review workflow supersedes the proposed core workspace status automation.

The extension owns `run-attempt`, `run-review`, `submit-change-request`, and `submit-review`. It records the implementation revision and review verdict explicitly. A session ending is not a review verdict, and one review cannot approve a different HEAD.

See [Planner attempts](../../../extensions/pstdio-planner/docs/attempts.md) for current states and commands. Do not reintroduce core ticket attempt-status endpoints or the old `review-ready`/`reviewed` workspace flags.
