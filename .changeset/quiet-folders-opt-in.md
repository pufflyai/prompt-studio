---
"pstdio": patch
---

Cloud copies a project folder only when it has a `.pstignore` file at its root. Project data already syncs as records, so folders without one are no longer uploaded a second time, and Prompt Studio no longer creates a starter `.pstignore`.
