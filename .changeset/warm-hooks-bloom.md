---
"pstdio": minor
---

Add worktree lifecycle hooks system. Define shell scripts in `.pstdio/hooks/<hook-name>` to run automatically during create, commit, merge, rebase, and remove events. Replaces startup_script with post-create hook.
