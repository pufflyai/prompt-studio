---
"pstdio": patch
---

Fix ticket-attempt lifecycle and settings: bootstrap worktrees for extension-created attempts, cascade workspace/session/worktree cleanup when a ticket is archived, stop attempt-status pills blanking on workspace changes, persist status/tag reordering and the workspace-status default, and reject unsupported ticket file uploads.
