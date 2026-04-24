---
layout: ../../../layouts/docs-layout.astro
title: Cleanup and recovery
description: Recover stuck worktrees, delete projects cleanly, and restore local ticket files.
htmlTitle: Cleanup and recovery
htmlDescription: Recover orphaned worktrees, delete projects cleanly, and restore local ticket files in Prompt Studio.
section: Guide
category: Operations
categoryOrder: 7
order: 2
---

## Stuck or leftover worktrees

If an agent crash left a worktree in place without updating the server, tear it down:

```bash
# List worktrees linked to a ticket.
pstdio tickets worktrees list --id PS-42

# Remove a specific workspace.
pstdio workspaces delete --id PS-42_A1

# Remove every worktree tied to the ticket.
pstdio tickets worktrees remove-all --id PS-42
```

These commands run `preWorktreeRemove` / `postWorktreeRemove` hooks. The underlying worktree is removed with `git worktree remove`.

If git itself reports a conflict (for example because the worktree's branch has uncommitted changes you want to keep), resolve it in git first before re-running the remove.

## Delete a project

```bash
pstdio projects delete <project-id>
```

This marks the project deleted server-side. It does **not** remove:

- `.pstdio/config.json` in your repo.
- `.pstdio/tickets/` folder.
- Local worktrees.

Remove those manually if you no longer need them.

## Recover local ticket files

If you lost the `.pstdio/tickets/` folder (for example, you committed `.pstdio/` to `.gitignore` and cleaned your checkout), pull everything back from the server:

```bash
pstdio tickets pull
pstdio tickets pull --id PS-42 --force
```

`--force` overwrites any existing local files. Without it, `pull` refuses to clobber uncommitted local edits.

## Fix a drifted database

If the dashboard shows ticket status that doesn't match `ticket.md`, the local file is the out-of-date one. Save your local edits:

```bash
pstdio tickets save --id PS-42
```

Or discard them and re-pull:

```bash
pstdio tickets pull --id PS-42 --force
```

## Related pages

- [Workspaces and worktrees](/docs/concepts/workspaces-and-worktrees/).
- [Local ticket files](/docs/workflows/local-ticket-files/).
- [Troubleshooting → Worktree cleanup failed](/docs/troubleshooting/common-issues/#worktree-cleanup-failed).
