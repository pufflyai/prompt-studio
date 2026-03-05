# CLI Spec: `pstdio workspaces`

## Purpose

Manage workspaces — instantiated project environments where agents operate. A workspace is an isolated copy of the project's repos, backed by git worktrees (local) or cloned repos (cloud, future). Workspace metadata is DB-backed, while code changes live in the local worktree checkouts.

---

## Terminology

- **Workspace**: an instantiation of a project's repo configuration. For single-repo projects, the workspace root _is_ the worktree. For multi-repo projects, the root contains one worktree subdirectory per repo. Tracked by a DB record (`workspaces` + optionally `ticket_workspaces`).
- **Workspace Shorthand**: `<ticket-shorthand>_<workspace-attempt>` (for example `PS-1_A1`) that uniquely identifies a workspace.
- **Workspace Attempt Shorthand**: per-ticket attempt token (`A1`, `A2`, ...). The full workspace shorthand is globally unique because it includes the ticket shorthand prefix.
- **Workspace Root**: `~/.pstdio/workspaces/<workspace-shorthand>/` — for single-repo projects this is the worktree itself; for multi-repo projects this is the parent directory containing one subdirectory per repo.
- **Git Worktree**: a local git working tree created from a project repo's local clone. One per repo per workspace.
- **Swap State**: temporary local state used by `pstdio workspaces swap` to preview a workspace in the main checkout.

## Derived Paths (Convention)

All paths are derived from the workspace shorthand and the project's repo list. Nothing is stored in the DB.

**Single-repo project:**

| Path                        | Derivation                          |
| --------------------------- | ----------------------------------- |
| Workspace root (= worktree) | `~/.pstdio/workspaces/<shorthand>/` |
| Branch                      | `workspace/<shorthand>`             |

**Multi-repo project:**

| Path              | Derivation                                                      |
| ----------------- | --------------------------------------------------------------- |
| Workspace root    | `~/.pstdio/workspaces/<shorthand>/`                             |
| Per-repo worktree | `~/.pstdio/workspaces/<shorthand>/<repo.name>/`                 |
| Per-repo branch   | `workspace/<shorthand>` (same branch name applied to each repo) |

---

## Command Summary

| Command                     | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `pstdio workspaces create`  | Create a workspace for a ticket.                            |
| `pstdio workspaces list`    | List active workspaces.                                     |
| `pstdio workspaces swap`    | Temporarily preview workspace changes in the main checkout. |
| `pstdio workspaces merge`   | Squash-merge workspace changes into the current branch.     |
| `pstdio workspaces delete`  | Force-remove a workspace from DB metadata and local git.    |
| `pstdio workspaces diff`        | Show the git diff for a workspace.                          |
| `pstdio workspaces startup-log` | Show the startup script log for a workspace.                |

---

## `pstdio workspaces create`

### Usage

```sh
pstdio workspaces create --id <ticket-id> [--base <ref>] [--target <target>]
```

### Flags

| Flag       | Type     | Required | Description                                                                                 |
| ---------- | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `--id`     | `string` | yes      | Ticket shorthand (for example `PS-12`).                                                     |
| `--base`   | `string` | no       | Base branch/ref for the new workspace branch. Defaults to current `HEAD`.                   |
| `--target` | `string` | no       | Workspace execution target. Defaults to `worktree`. Currently only `worktree` is supported. |

### Behavior

1. Must run inside a linked pstdio project.
2. Resolves the ticket by shorthand in the current project.
3. Resolves target from `--target` (default: `worktree`).
4. Resolves the base ref (`--base` or current `HEAD`).
5. Fetches the project's repo list from the database.
6. Allocates a new workspace shorthand for the ticket in the form `<ticket-shorthand>_A<n>` (for example `PS-12_A1`). The sequence counter `n` is based on the **total number of workspaces ever created** for the ticket, including deleted and archived ones, to avoid shorthand reuse.
7. For target `worktree`, creates worktrees based on the number of project repos:
   - **Single-repo**: creates a workspace branch (`workspace/<workspace-shorthand>`) from the base ref in the repo's local clone (`repos.path`), and creates a git worktree directly at `~/.pstdio/workspaces/<workspace-shorthand>/`.
   - **Multi-repo**: creates the workspace root directory at `~/.pstdio/workspaces/<workspace-shorthand>/`, then for each repo creates a workspace branch (`workspace/<workspace-shorthand>`) from the base ref and a git worktree at `~/.pstdio/workspaces/<workspace-shorthand>/<repo.name>/`.
8. Persists workspace metadata in the database:
   - Create row in `workspaces` with `workspace_shorthand` (not null), `name` (defaults to the workspace shorthand), nullable `session_id`, `status=active`.
   - Create row in `ticket_workspaces` linking the ticket to the workspace.
9. Reads the project's `startup_script` from the database.
10. If non-null, executes the script inside the workspace root directory using the user's default shell.
11. Streams script stdout/stderr to the terminal while capturing them into a buffer.
12. After the script finishes (success or failure), uploads the captured output as a tracked file (`file_kind: startup_log`) via the files API and links it to the workspace via `startup_log_file_id`.
13. If the script exits with a non-zero code, prints a warning and the retrieval command but does **not** fail workspace creation.

### Output

When no startup script is configured:

```text
Created workspace PS-12_A1 for PS-12 at ~/.pstdio/workspaces/PS-12_A1
```

When a startup script runs successfully:

```text
Created workspace PS-12_A1 for PS-12 at ~/.pstdio/workspaces/PS-12_A1
Running startup script...
<script output>
Startup script completed.
```

When the startup script fails:

```text
Created workspace PS-12_A1 for PS-12 at ~/.pstdio/workspaces/PS-12_A1
Running startup script...
<script output>
Warning: startup script exited with code 1.
Startup log saved. View with: pstdio workspaces startup-log --id PS-12_A1
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json`.
- `"Ticket not found: <ticket-id>"`: ticket shorthand is unknown in the current project.
- `"Project has no repos. Use 'pstdio projects link' to connect repos first."`: no repos linked to the project.
- `"Repo not available locally: <repo.name>. Clone it or run 'pstdio projects link' from the repo."`: a project repo has no local `path` on this machine.
- `"Base ref not found: <ref>"`: invalid `--base` value.
- `"Invalid target: <target>. Must be 'worktree'."`: unsupported workspace target.

---

## `pstdio workspaces list`

### Usage

```sh
pstdio workspaces list
```

### Flags

None.

### Behavior

1. Must run inside a linked project.
2. Reads active workspace metadata from the database.
3. Shows each workspace with workspace shorthand, ticket ID, status, and repo count.

### Output

```text
Workspace   Ticket   Status   Repos
PS-12_A1    PS-12    active   2
PS-12_A2    PS-12    active   2
```

If no workspaces exist:

```text
No active workspaces.
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `.pstdio/config.json` found.

---

## `pstdio workspaces swap`

### Usage

```sh
pstdio workspaces swap --id <workspace-shorthand>
pstdio workspaces swap --status
pstdio workspaces swap --back
```

### Flags

| Flag       | Type      | Required | Description                                                                                           |
| ---------- | --------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `--id`     | `string`  | no       | Workspace shorthand to preview (for example `PS-1_A1`). Required unless using `--status` or `--back`. |
| `--status` | `boolean` | no       | Print active swap state. Informational only.                                                          |
| `--back`   | `boolean` | no       | Restore original checkout and clear swap state.                                                       |

### Behavior

- Exactly one of `--id`, `--status`, or `--back` must be provided.

`swap --id`:

1. Requires no active swap state.
2. Requires a clean working tree in all project repo checkouts.
3. Resolves the target workspace from DB metadata.
4. For each project repo: captures the current branch/commit and checks out a temporary preview branch (`preview/<workspace-shorthand>`) at the tip commit of the workspace branch (`workspace/<workspace-shorthand>`).
5. Writes swap metadata to `.pstdio/swap.json` (records per-repo original branch/commit).
6. If dependency manifests changed (for example `package.json`, `bun.lockb`), prints a reminder to run `bun install`.

`swap --status`:

1. Reads `.pstdio/swap.json`.
2. If swap is active, prints the active workspace and preview branch.
3. If no swap is active, prints `No active swap.` and exits with code `0`.

`swap --back`:

1. Requires an active swap state.
2. Requires a clean working tree in all swapped repo checkouts.
3. For each repo: restores the original branch and commit from swap metadata, and force-deletes the preview branch (`preview/<workspace-shorthand>`).
4. Removes `.pstdio/swap.json`.

### Output

```text
Swapped to workspace PS-12_A1
```

```text
Swap active: workspace PS-12_A1 on branch preview/PS-12_A1
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
- `"Already swapped - run 'workspaces swap --back' first"`: cannot run `swap --id` while swap is active.
- `"No active swap"`: attempting `swap --back` with no state file.
- `"Branch has uncommitted changes in <repo.name>"`: all repo checkouts must be clean before `swap --id` or `swap --back`.
- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.

---

## `pstdio workspaces merge`

### Usage

```sh
pstdio workspaces merge --id <workspace-shorthand> [--delete-workspace]
```

### Flags

| Flag                 | Type      | Required | Description                                           |
| -------------------- | --------- | -------- | ----------------------------------------------------- |
| `--id`               | `string`  | yes      | Workspace shorthand to merge (for example `PS-1_A1`). |
| `--delete-workspace` | `boolean` | no       | Delete the workspace after successful merge.          |

### Behavior

1. Must run on a clean working tree in all project repo checkouts.
2. Resolves the target workspace from DB metadata.
3. For each project repo:
   - Resolves the workspace branch (`workspace/<workspace-shorthand>`) and its tip commit.
   - Performs a squash merge of the workspace branch into the current branch (`git merge --squash workspace/<workspace-shorthand>`).
   - Creates one commit with message `workspace(<workspace-shorthand>): squash merge`.
4. If conflicts occur in any repo, aborts all merges with `git reset --merge` and reports conflicting files per repo.
5. If `--delete-workspace` is set and all merges succeed, runs the same force-remove flow as `pstdio workspaces delete`.

### Output

```text
Merged workspace PS-12_A1 as a squash commit.
```

When `--delete-workspace` is set:

```text
Merged workspace PS-12_A1 and deleted workspace.
```

### Errors

- `"Branch has uncommitted changes in <repo.name>"`: all repo checkouts must be clean before merge.
- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.
- `"Merge conflict in <repo.name>"`: conflict occurred in one or more repos; all merges are aborted. Command exits with code `1`.

---

## `pstdio workspaces delete`

### Usage

```sh
pstdio workspaces delete --id <workspace-shorthand>
```

### Flags

| Flag   | Type     | Required | Description                                            |
| ------ | -------- | -------- | ------------------------------------------------------ |
| `--id` | `string` | yes      | Workspace shorthand to delete (for example `PS-1_A1`). |

### Behavior

1. Resolves the workspace from DB metadata.
2. If the workspace is currently swapped, performs the swap-back flow first.
3. Removes workspace DB metadata (`ticket_workspaces` association and marks the `workspaces` row as deleted/archived).
4. For each project repo: force-removes git worktree tracking and force-deletes the workspace branch (`workspace/<workspace-shorthand>`) if it still exists.
5. Removes the workspace root directory (`~/.pstdio/workspaces/<workspace-shorthand>/`) from disk, even if dirty.
6. Does not merge workspace changes.

### Output

```text
Deleted workspace PS-12_A1
```

### Errors

- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.

---

## `pstdio workspaces diff`

### Usage

```sh
pstdio workspaces diff --id <workspace-shorthand> [--mode <mode>]
```

### Flags

| Flag     | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `--id`   | `string` | yes      | Workspace shorthand (e.g. `PS-12_A1`).                           |
| `--repo` | `string` | no       | Repo name to diff. If omitted, diffs all repos in the workspace. |
| `--mode` | `string` | no       | Diff mode: `unstaged`, `staged`, or `all`. Defaults to `all`.    |

### Behavior

1. Resolves the workspace from DB metadata by shorthand.
2. Resolves the target repo(s): uses `--repo` if provided, otherwise iterates all project repos.
3. For each repo, computes the git diff in the repo's worktree directory (`~/.pstdio/workspaces/<shorthand>/<repo.name>/`).
4. Prints the diff output with per-file entries and aggregate totals, grouped by repo when showing multiple repos.

### Output

Single-repo project:

```text
3 files changed, 42 additions, 12 deletions

src/auth.ts        | +30 -5
src/auth.test.ts   | +10 -2
src/types.ts       | +2  -5

[diff output]
```

Multi-repo project (all repos):

```text
api (2 files changed, 32 additions, 5 deletions)

  src/auth.ts        | +30 -5
  src/auth.test.ts   | +2  -0

web (1 file changed, 10 additions, 7 deletions)

  src/login.tsx      | +10 -7

[diff output]
```

If there are no changes:

```text
No changes in workspace PS-12_A1.
```

### Errors

- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.
- `"Repo not found: <name>"`: the given repo name does not exist in the project.

---

## `pstdio workspaces startup-log`

### Usage

```sh
pstdio workspaces startup-log --id <workspace-shorthand>
```

### Flags

| Flag   | Type     | Required | Description                            |
| ------ | -------- | -------- | -------------------------------------- |
| `--id` | `string` | yes      | Workspace shorthand (e.g. `PS-12_A1`). |

### Behavior

1. Resolves the workspace from DB metadata by shorthand.
2. Fetches the startup log file content via `GET /v1/workspaces/:id/startup-log`.
3. Prints the log content to stdout.
4. If no startup log exists, prints a message and exits.

### Output

When a startup log exists:

```text
<startup script output>
```

When no startup log exists:

```text
No startup log for workspace PS-12_A1.
```

### Errors

- `"Workspace not found: <workspace-shorthand>"`: unknown workspace.

---

## Local Side Effects

| Path                                                      | Description                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `~/.pstdio/workspaces/<workspace-shorthand>/`             | Workspace root directory.                                       |
| `~/.pstdio/workspaces/<workspace-shorthand>/<repo.name>/` | Git worktree for each project repo.                             |
| `.pstdio/swap.json`                                       | Temporary swap state used by `swap --status` and `swap --back`. |

### `.pstdio/swap.json` Schema

```json
{
  "workspace_shorthand": "PS-12_A1",
  "repos": [
    {
      "repo_name": "api",
      "original_branch": "main",
      "original_commit": "abc123def"
    },
    {
      "repo_name": "web",
      "original_branch": "main",
      "original_commit": "def456abc"
    }
  ],
  "preview_branch": "preview/PS-12_A1"
}
```

For single-repo projects, the `repos` array has one entry.

## Database Side Effects

| Table               | Description                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces`        | Workspace lifecycle metadata (`workspace_shorthand` (not null), `name` (defaults to shorthand), nullable `session_id`, `status`, nullable `startup_log_file_id`). |
| `ticket_workspaces` | Ticket to workspace association used for ticket shorthand resolution.                                                                                             |
| `files`             | Stores the startup log file content (file_kind: `startup_log`). Linked from `workspaces.startup_log_file_id`.                                                    |

### Schema Changes Required

- `workspaces.workspace_shorthand`: change from nullable to `NOT NULL`.
- `workspaces.name`: defaults to the workspace shorthand when not explicitly provided.
- `workspaces.branch`: remove from the schema. Derived as `workspace/<shorthand>`.
- `workspaces.worktree_path`: remove from the schema. Derived as `~/.pstdio/workspaces/<shorthand>/`.
- `workspaces.repo_id`: remove from the schema. Workspaces span all project repos.

> **Note:** The `workspace_artifacts` table exists in the schema but is **out of scope** for this spec. It will be covered in a separate spec.

---

## Exit Codes

- `0`: Command completed successfully.
- `1`: Command failed (validation error, git error, or merge conflict).
