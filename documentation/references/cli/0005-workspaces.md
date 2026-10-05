# Workspaces

A workspace is where sessions run. A project's default folder workspace shares files between sessions and needs no Git setup.

```sh
pst workspaces create --provider <id> [--params <json>]
pst workspaces list [--json]
pst workspaces merge --id <workspace-shorthand> [--delete-workspace]
pst workspaces delete --id <workspace-shorthand>
```

A workspace shorthand is the short name shown in workspace lists, such as `PS-1_A1`.

## Create a workspace

A workspace provider creates each additional workspace. Providers declare their own parameters. The dashboard lists the providers that can create workspaces and shows their parameters. The project's own workspace is listed separately. A plain folder has no creation choices until an extension supplies a provider.

In the dashboard's creation dialog, choose **Workspace type**, then fill in the provider's fields. For **Git worktree**, choose **Base branch** from the project's branches. The current branch is selected first. A detached checkout also offers **Current checkout (no branch)**. Select **Create workspace** to submit, or **Cancel** to close.

On the CLI, pass the provider ID and its parameters as JSON:

```sh
pst workspaces create --provider pstdio.worktree --params '{"base":"main"}'
```

Parameters are checked before anything is created. Unknown keys and missing required values fail, and the error lists the accepted parameters and choices. Omitted values use their declared defaults. The Git `base` parameter defaults to the current branch. It also accepts any valid commit, such as `HEAD` or a commit SHA. An invalid revision fails before a workspace record or worktree is created.

## Git worktrees

The Git provider needs a repository with at least one commit. For a project in a repository subfolder, sessions run in the matching subfolder of the worktree. Files stay within that folder, but Git diff and merge include every changed path in the repository.

`merge` works only for Git workspaces. It squash-merges the provider-created branch into the current branch. `--delete-workspace` removes the workspace after a successful merge.

## Remote workspaces and cleanup

Remote providers supply their own source and environment. They do not upload or sync the project folder.

`delete` asks the provider to clean up its resources and removes the workspace. Folders that you chose yourself stay on disk.

Run `pst workspaces <command> --help` for current options.
