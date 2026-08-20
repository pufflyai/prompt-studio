---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI workspaces

The core workspace commands manage standalone Git worktrees. Planner ticket attempts create their own linked workspaces through Planner commands.

## Commands

```sh
pst workspaces create [--base <ref>] [--target worktree]
pst workspaces list [--json]
pst workspaces merge --id <workspace-id> [--delete-workspace]
pst workspaces delete --id <workspace-id>
```

`create` makes a worktree-backed workspace from `HEAD` or the ref passed to `--base`. The only supported target is `worktree`.

`list` prints active workspaces. Use `--json` when another tool needs the complete records.

`merge` squash-merges the workspace into the current branch. Add `--delete-workspace` to remove it after a successful merge.

`delete` force-removes the workspace metadata, worktree, and workspace branch. Save any work you need before running it.

Run `pst workspaces <command> --help` for current options.
