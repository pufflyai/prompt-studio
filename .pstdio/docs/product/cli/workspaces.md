---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI workspaces

The core workspace commands manage standalone Git worktrees. Planner ticket attempts create their own linked workspaces through Planner commands.

## Commands

```sh
pst workspaces create [--base <ref>] [--provider <id>] [--params <json>]
pst workspaces list [--json]
pst workspaces merge --id <workspace-id> [--delete-workspace]
pst workspaces delete --id <workspace-id>
```

`create` makes a worktree-backed workspace from `HEAD` or the ref passed to `--base`. Use `--provider` and `--params` for an extension provider.

`list` prints active workspaces. Use `--json` when another tool needs the complete records.

`merge` squash-merges the workspace into the current branch. Add `--delete-workspace` to remove it after a successful merge.

`delete` force-removes the workspace metadata, worktree, and workspace branch. Save any work you need before running it.

Run `pst workspaces <command> --help` for current options.

## Dashboard creation

Choose **Workspace type**, then fill in the fields declared by that provider.
For **Git worktree**, select **Base branch** from the project's available branches.
The current branch is selected initially. A checkout without a branch offers
**Current checkout (no branch)** as well. Use **Create workspace** in the footer
to submit, or **Cancel** to close the dialog.

During the alpha.10 release bridge, Git choices use the first linked repository,
matching workspace creation without an explicit legacy repository ID. Cloud
providers supply their own fields and do not require Git.
