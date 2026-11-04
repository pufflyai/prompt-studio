# Workspaces

A workspace is where sessions run. A project's default folder workspace shares files between sessions and needs no Git setup.

```sh
pst workspaces create --provider <id> [--params <json>] [--device <device-id>]
pst workspaces list [--json]
pst workspaces merge --id <workspace-shorthand> [--delete-workspace]
pst workspaces delete --id <workspace-shorthand> [--forget]
```

Run these commands inside a linked project. A workspace shorthand is the short name shown in workspace lists:

| Shorthand | Workspace |
| --- | --- |
| `default` | The project's default workspace. |
| `WS-1`, `WS-2`, ... | Standalone workspaces. `pst workspaces create` makes these and prints the new name, for example `Created workspace WS-1 at <path>`. Numbers count up within each project. |
| `PS-12_A1`, `PS-12_A2`, ... | Workspaces that an extension creates for one of its items. Planner uses the ticket ID, `_A`, and the attempt number, so the first attempt at ticket `PS-12` is `PS-12_A1`. |

`merge`, `delete`, and `file-link` accept a shorthand. `file-link` also accepts the workspace ID from `pst workspaces list`.

## Create a workspace

A workspace provider creates each additional workspace. Providers declare their own parameters. The dashboard lists the providers that can create workspaces and shows their parameters. The project's own workspace is listed separately. A plain folder has no creation choices until an extension supplies a provider.

In the dashboard's creation dialog, choose **Workspace type**, then fill in the provider's fields. For **Git worktree**, choose **Base branch** from the project's branches. The current branch is selected first. A detached checkout also offers **Current checkout (no branch)**. Select **Create workspace** to submit, or **Cancel** to close.

On the CLI, pass the provider ID and its parameters as JSON:

```sh
pst workspaces create --provider pstdio.worktree --params '{"base":"main"}'
```

The provider must be available on the current host. Unknown or unavailable providers fail before a workspace record is saved. Parameters are checked before anything is created. Unknown keys and missing required values fail, and the error lists the accepted parameters and choices. Omitted values use their declared defaults. The Git `base` parameter defaults to the current branch. It also accepts any valid commit, such as `HEAD` or a commit SHA. An invalid revision fails before a workspace record or worktree is created.

**Unreleased:** `--device <device-id>` creates a workspace on one of your online Cloud devices. Provider parameters and paths are interpreted there. Use `pst devices list` to find its ID. The project must sync on both devices; no command waits for an offline device.

## Git worktrees

The Git provider needs a repository with at least one commit. For a project in a repository subfolder, sessions run in the matching subfolder of the worktree. Files stay within that folder, but Git diff and merge include every changed path in the repository.

`merge` works only for Git workspaces. It squash-merges the provider-created branch into the current branch. `--delete-workspace` removes the workspace after a successful merge.

## Remote workspaces and cleanup

Remote providers supply their own source and environment. They do not upload or sync the project folder.

`delete` asks the provider to clean up its resources and removes the workspace. Folders that you chose yourself stay on disk.

If an orphaned record has a missing provider, remote execution kind, no saved provider reference, and no local path, explicitly discard it with:

```sh
pst workspaces delete --id WS-5 --forget
```

Forgetting removes the record and archives its sessions. It abandons recovery and leaves any remote resource unchanged. A missing reference can mean a remote creation response was lost, so check the provider directly for resources before forgetting. Normal deletion preserves recovery when the provider or its response is unavailable. Default workspaces, local workspaces, and workspaces with a saved backing reference cannot be forgotten.

The HTTP API accepts `DELETE /v1/workspaces/{id}?forget=true`. SDK clients use `client.workspaces.delete(id, { forget: true })`. Omitting the option, or passing `false`, keeps normal deletion behavior.

Forgetting checks eligibility before cancelling or archiving sessions. If session cleanup fails after the record is removed, repeat the HTTP or SDK request with the same workspace ID to finish cleanup. The saved workspace/session links remain available for that retry.

Run `pst workspaces <command> --help` for current options.

## File links

Run inside a linked project:

```sh
pst workspaces file-link --workspace WS-1 --path src/app.ts --line 12 --column 4
```

The command accepts a workspace shorthand or UUID and prints JSON containing `href`, a canonical dashboard path. Paths are workspace-root relative. The command does not read or change the file. A column requires a line; coordinates must be positive integers. Copied URLs restore the selected file after reload. Unreleased Cloud device commands let the API read another device's files and diff while that device is online; remote file content is read-only.
