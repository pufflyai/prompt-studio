# CLI workspaces

A workspace is where sessions run. A project's default folder workspace shares files between sessions and requires no Git setup.

```sh
pst workspaces create --provider <id> [--params <json>]
pst workspaces list [--json]
pst workspaces merge --id <workspace-id> [--delete-workspace]
pst workspaces delete --id <workspace-id>
```

Providers declare their own parameters. The dashboard lists available providers and renders these parameters.

```sh
pst workspaces create --provider pstdio.worktree --params '{"base":"HEAD"}'
```

The Git provider requires a usable commit. For a project in a repository subfolder, sessions run in the matching worktree subfolder. Files stay within that folder; Git diff and merge include all changed repository paths.

`merge` is available only for Git-capable workspaces. It squash-merges the provider-created branch. `--delete-workspace` removes that workspace after a successful merge.

Remote providers supply their own source and environment. They do not upload or synchronize the project folder. `delete` delegates resource cleanup to the provider and preserves user-selected folders.

Run `pst workspaces <command> --help` for current options.
