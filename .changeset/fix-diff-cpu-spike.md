---
"pstdio": patch
---

Fix workspace diff CPU spike: only fetch diffs for settled attempts on kanban, add lightweight diff-summary endpoint, refresh diffs on edit actions in workspace page. **Breaking:** `resolveBase` now prefers the reflog fork point over merge-base, so diffs reflect the actual branch creation point rather than moving with the default branch.
