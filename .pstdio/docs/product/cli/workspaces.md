# CLI workspaces

A workspace is where sessions run. A project's default folder workspace shares files between sessions and requires no Git setup.

```sh
pst workspaces create --provider <id> [--params <json>]
pst workspaces list [--json]
pst workspaces merge --id <workspace-id> [--delete-workspace]
pst workspaces delete --id <workspace-id>
```

Providers declare their own parameters. The dashboard lists providers that create additional workspaces and renders these parameters. The existing project workspace is listed separately. A plain folder has no creation choices until an extension supplies a provider.

In the creation dialog, choose **Workspace type**, then fill in the provider's fields.
For **Git worktree**, choose **Base branch** from the project's branches. The current
branch is selected initially; a detached checkout also offers **Current checkout
(no branch)**. Use **Create workspace** in the footer to submit, or **Cancel** to close.

```sh
pst workspaces create --provider pstdio.worktree --params '{"base":"HEAD"}'
```

The Git provider requires a usable commit. For a project in a repository subfolder, sessions run in the matching worktree subfolder. Files stay within that folder; Git diff and merge include all changed repository paths.

`merge` is available only for Git-capable workspaces. It squash-merges the provider-created branch. `--delete-workspace` removes that workspace after a successful merge.

Remote providers supply their own source and environment. They do not upload or synchronize the project folder. `delete` delegates resource cleanup to the provider and preserves user-selected folders.

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
