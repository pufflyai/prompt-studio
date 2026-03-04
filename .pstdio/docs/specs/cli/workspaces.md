# CLI Spec: `pstdio workspace`

## Purpose

Manage ticket-scoped workspaces backed by git worktrees. Workspace metadata is DB-backed, while code changes live in local git worktree checkouts.

---

## Terminology

- **Workspace**: a DB record (`workspaces` + `ticket_workspaces`) plus its code environment.
- **Workspace Shorthand**: `<ticket-shorthand>/<workspace-shorthand>` (for example `PS-1/A1`) that uniquely identifies a workspace.
- **Workspace Attempt Shorthand**: per-ticket attempt token (`A1`, `A2`, ...). The full workspace shorthand is globally unique because it includes the ticket shorthand prefix.
- **Git Worktree**: the local git working tree used as the code environment for a workspace.
- **Swap State**: temporary local state used by `workspace swap` to preview a workspace in the main checkout.

---

## Command Summary

| Command                   | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `pstdio workspace create` | Create a workspace for a ticket.                            |
| `pstdio workspace list`   | List active workspaces.                                     |
| `pstdio workspace swap`   | Temporarily preview workspace changes in the main checkout. |
| `pstdio workspace merge`  | Squash-merge workspace changes into the current branch.     |
| `pstdio workspace delete` | Force-remove a workspace from DB metadata and local git.    |

---

## `pstdio workspace create`

### Usage

```sh
pstdio workspace create --id <ticket-id> [--base <ref>] [--target <target>]
```

### Flags

| Flag       | Type     | Required | Description                                                                                 |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `--id`     | `string` | yes      | Ticket shorthand (for example `PS-12`).                                                     |
| `--base`   | `string` | no       | Base branch/ref for the new workspace branch. Defaults to current `HEAD`.                  |
| `--target` | `string` | no       | Workspace execution target. Defaults to `worktree`. Currently only `worktree` is supported. |

### Behavior

1. Must run inside a git repository linked to a pstdio project.
2. Resolves the ticket by shorthand in the current project.
3. Resolves target from `--target` (default: `worktree`).
4. Resolves the base ref (`--base` or current `HEAD`).
5. Allocates a new workspace shorthand for the ticket in the form `<ticket-shorthand>/A<n>` (for example `PS-12/A1`), even when other workspaces already exist for the same ticket.
6. For `--target worktree`, creates a workspace branch (`workspace/<workspace-shorthand>`) and git worktree rooted under `.pstdio/workspaces/<workspace-shorthand>/`.
7. Persists workspace metadata in the database:
   - create row in `workspaces` (`workspace_shorthand`, nullable `session_id`, `status=active`, `branch`, `worktree_path`).
   - create row in `ticket_workspaces` linking the ticket to the workspace.

### Output

```text
Created workspace PS-12/A1 for PS-12 at .pstdio/workspaces/PS-12/A1
```

### Errors

- `"Not inside a git repository."`: no git root found.
- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json`.
- `"Ticket not found: <ticket-id>"`: ticket shorthand is unknown in the current project.
- `"Base ref not found: <ref>"`: invalid `--base` value.
- `"Invalid target: <target>. Must be 'worktree'."`: unsupported workspace target.

---

## `pstdio workspace list`

### Usage

```sh
pstdio workspace list
```

### Flags

None.

### Behavior

1. Must run inside a linked project.
2. Reads active workspace metadata from the database.
3. Shows each workspace with workspace shorthand, ticket ID, branch, and absolute path.

### Output

```text
Workspace   Ticket   Branch               Path
PS-12/A1    PS-12    workspace/PS-12/A1   /repo/.pstdio/workspaces/PS-12/A1
PS-12/A2    PS-12    workspace/PS-12/A2   /repo/.pstdio/workspaces/PS-12/A2
```

If no workspaces exist:

```text
No active workspaces.
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.

---

## `pstdio workspace swap`

### Usage

```sh
pstdio workspace swap --id <workspace-shorthand>
pstdio workspace swap --status
pstdio workspace swap --back
```

### Flags

| Flag       | Type      | Required | Description                                                                                              |
| ---------- | --------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `--id`     | `string`  | no       | Workspace shorthand to preview (for example `PS-1/A1`). Required unless using `--status` or `--back`. |
| `--status` | `boolean` | no       | Print active swap state. Informational only.                                                             |
| `--back`   | `boolean` | no       | Restore original checkout and clear swap state.                                                          |

### Behavior

- Exactly one of `--id`, `--status`, or `--back` must be provided.

`swap --id`:

1. Requires no active swap state.
2. Requires a clean working tree in the current checkout.
3. Resolves the target workspace from DB metadata.
4. Captures the current branch/commit and writes swap metadata to `.pstdio/swap.json`.
5. Checks out a temporary preview branch (`preview/<workspace-shorthand>`) at the workspace commit.
6. If dependency manifests changed (for example `package.json`, `bun.lockb`), prints a reminder to run `bun install`.

`swap --status`:

1. Reads `.pstdio/swap.json`.
2. If swap is active, prints the active workspace and preview branch.
3. If no swap is active, prints `No active swap.` and exits with code `0`.

`swap --back`:

1. Requires an active swap state.
2. Requires a clean working tree in the current checkout.
3. Restores the original branch and commit from swap metadata.
4. Deletes temporary preview branches.
5. Removes `.pstdio/swap.json`.

### Output

```text
Swapped to workspace PS-12/A1
```

```text
Swap active: workspace PS-12/A1 on branch preview/PS-12/A1
```

When no swap is active:

```text
No active swap.
```

```text
Restored original branch and cleared swap state.
```

### Errors

- `"Exactly one of --id, --status, --back is required"`: invalid flag combination.
- `"Already swapped - run 'workspace swap --back' first"`: cannot run `swap --id` while swap is active.
- `"No active swap"`: attempting `swap --back` with no state file.
- `"Branch has uncommitted changes"`: checkout must be clean before `swap --id` or `swap --back`.
- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.

---

## `pstdio workspace merge`

### Usage

```sh
pstdio workspace merge --id <workspace-shorthand> [--delete-workspace]
```

### Flags

| Flag                 | Type      | Required | Description                                                           |
| -------------------- | --------- | -------- | --------------------------------------------------------------------- |
| `--id`               | `string`  | yes      | Workspace shorthand to merge (for example `PS-1/A1`).                |
| `--delete-workspace` | `boolean` | no       | Delete the workspace after successful merge.                          |

### Behavior

1. Must run on a clean current checkout.
2. Resolves the target workspace from DB metadata.
3. Resolves the workspace tip commit from the workspace branch.
4. Performs a squash merge into the current branch.
5. Creates one commit with message `workspace(<workspace-shorthand>): squash merge`.
6. If conflicts occur, aborts merge with `git reset --merge` and reports conflicting files.
7. If `--delete-workspace` is set and merge succeeds, runs the same force-remove flow as `workspace delete`.

### Output

```text
Merged workspace PS-12/A1 as a squash commit.
```

When `--delete-workspace` is set:

```text
Merged workspace PS-12/A1 and deleted workspace.
```

### Errors

- `"Branch has uncommitted changes"`: current checkout must be clean before merge.
- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.
- `"Merge conflict"`: conflict occurred; command exits with code `1` after abort.

---

## `pstdio workspace delete`

### Usage

```sh
pstdio workspace delete --id <workspace-shorthand>
```

### Flags

| Flag   | Type     | Required | Description                                                    |
| ------ | -------- | -------- | -------------------------------------------------------------- |
| `--id` | `string` | yes      | Workspace shorthand to delete (for example `PS-1/A1`).        |

### Behavior

1. Resolves the workspace from DB metadata.
2. If the workspace is currently swapped, performs the swap-back flow first.
3. Removes workspace DB metadata (`ticket_workspaces` association and marks the `workspaces` row as deleted/archived).
4. Force-removes git worktree tracking and the workspace directory from disk, even if dirty.
5. Force-deletes the workspace branch if it still exists.
6. Does not merge workspace changes.

### Output

```text
Deleted workspace PS-12/A1
```

### Errors

- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.

---

## Local Side Effects

| Path                                      | Description                                                     |
| ----------------------------------------- | --------------------------------------------------------------- |
| `.pstdio/workspaces/<workspace-shorthand>/` | Physical git worktree directory for the workspace.            |
| `.pstdio/swap.json`                       | Temporary swap state used by `swap --status` and `swap --back`. |

## Database Side Effects

| Table               | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `workspaces`        | Workspace lifecycle metadata (`workspace_shorthand`, nullable `session_id`, `status`, `branch`, `worktree_path`). |
| `ticket_workspaces` | Ticket to workspace association used for ticket shorthand resolution.             |

---

## Exit Codes

- `0`: Command completed successfully.
- `1`: Command failed (validation error, git error, or merge conflict).
