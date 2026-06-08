---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Workspaces

## Summary

This PRD documents current single-repo workspace commands for create, list, merge, and delete behavior.

## Detailed Behavior

## Purpose

Manage active workspaces for a project.

This PRD describes the currently implemented CLI behavior, which is single-repo workspace management.

Multi-repo behavior is tracked separately in draft form:
[`workspaces-multi-repo`](./proposals/workspaces-multi-repo.md).

---

## Terminology

- **Workspace**: a DB-backed record linked to a ticket and represented locally as a git worktree.
- **Workspace shorthand**: `<ticket-shorthand>_A<n>` (for example `PS-12_A1`).
- **Workspace branch**: `workspace/<workspace-shorthand>`.
- **Workspace path**: `~/.pstdio/workspaces/<workspace-shorthand>/`.

---

## Command Summary

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `pst workspaces create` | Create a workspace for a ticket.                         |
| `pst workspaces list`   | List active workspaces.                                  |
| `pst workspaces merge`  | Squash-merge workspace changes into the current branch.  |
| `pst workspaces delete` | Force-remove a workspace from DB metadata and local git. |

---

## `pst workspaces create`

### Usage

```sh
pst workspaces create --id <ticket-shorthand> [--base <ref>] [--target worktree]
```

### Flags

| Flag       | Type     | Required | Description                                                       |
| ---------- | -------- | -------- | ----------------------------------------------------------------- |
| `--id`     | `string` | yes      | Ticket shorthand (for example `PS-12`).                           |
| `--base`   | `string` | no       | Base branch/ref for the new workspace branch. Defaults to `HEAD`. |
| `--target` | `string` | no       | Workspace target. Only `worktree` is accepted.                    |

### Behavior

1. Must run inside a git repository.
2. Must run inside a linked Prompt Studio project.
3. Resolves the ticket by shorthand in the current project.
4. Creates a workspace via API and receives an allocated workspace shorthand (`<ticket>_A<n>`).
5. Creates a local git worktree from the current repo root at `~/.pstdio/workspaces/<workspace-shorthand>/` on branch `workspace/<workspace-shorthand>`.
6. Prints the created workspace shorthand and path.
7. Backend emits the worktree-created extension event after the workspace is created.
8. Default worktree automation copies Prompt Studio project metadata into the worktree.
9. Event-handler failures are logged without rolling back workspace creation.

### Output

```text
Created workspace PS-12_A1 for PS-12 at ~/.pstdio/workspaces/PS-12_A1
```

### Errors

- `"Not inside a git repository."`
- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`
- `"Ticket not found: <ticket-id>"`
- `"Invalid target: <target>. Must be 'worktree'."`

---

## `pst workspaces list`

### Usage

```sh
pst workspaces list
```

### Flags

None.

### Behavior

1. Must run inside a linked Prompt Studio project.
2. Reads active workspaces from API for the current project.
3. Prints a table-like list with columns: `Workspace`, `Ticket`, `Branch`, `Path`.

### Output

```text
Workspace   Ticket   Branch               Path
PS-12_A1    PS-12    workspace/PS-12_A1   /Users/you/.pstdio/workspaces/PS-12_A1
```

If no workspaces exist:

```text
No active workspaces.
```

### Errors

- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`
- `"Failed to list workspaces: <status>"`

---

## `pst workspaces merge`

### Usage

```sh
pst workspaces merge --id <workspace-shorthand> [--delete-workspace]
```

### Flags

| Flag                 | Type      | Required | Description                                     |
| -------------------- | --------- | -------- | ----------------------------------------------- |
| `--id`               | `string`  | yes      | Workspace shorthand (for example `PS-12_A1`).   |
| `--delete-workspace` | `boolean` | no       | Delete workspace metadata/worktree after merge. |

### Behavior

1. Must run inside a git repository.
2. Must run on a clean working tree.
3. Resolves workspace by shorthand for the current project.
4. Squash-merges workspace branch into the current branch.
5. Commit message: `workspace(<workspace-shorthand>): squash merge`.
6. If merge conflicts occur, resets merge state and exits with an error.
7. If `--delete-workspace` is set, soft-deletes workspace metadata and removes worktree/branch.

### Output

```text
Merged workspace PS-12_A1 as a squash commit.
```

When `--delete-workspace` is set:

```text
Merged workspace PS-12_A1 and deleted workspace.
```

### Errors

- `"Not inside a git repository."`
- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`
- `"Branch has uncommitted changes"`
- `"Workspace not found: <workspace-shorthand>"`
- `"Merge conflict"`

---

## `pst workspaces delete`

### Usage

```sh
pst workspaces delete --id <workspace-shorthand>
```

### Flags

| Flag   | Type     | Required | Description                                   |
| ------ | -------- | -------- | --------------------------------------------- |
| `--id` | `string` | yes      | Workspace shorthand (for example `PS-12_A1`). |

### Behavior

1. Must run inside a git repository.
2. Must run inside a linked Prompt Studio project.
3. Resolves workspace by shorthand.
4. Runs extension command middleware for worktree removal if registered (blocking — rejection aborts deletion).
5. Soft-deletes workspace metadata via API.
6. Removes local worktree and workspace branch (force).
7. Runs `post-remove` hook if exists (non-blocking).
8. Prints completion message.

### Output

```text
Deleted workspace PS-12_A1
```

### Errors

- `"Not inside a git repository."`
- `"Not inside a Prompt Studio project. Run 'pst projects create' first."`
- `"Workspace not found: <workspace-shorthand>"`

---

## Local Side Effects

| Path                                          | Description                   |
| --------------------------------------------- | ----------------------------- |
| `~/.pstdio/workspaces/<workspace-shorthand>/` | Local git worktree directory. |

---

## Storage Side Effects

| Table           | Description                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspaces`    | Workspace lifecycle metadata (`workspace_shorthand`, `name`, `branch`, `worktree_path`, `is_default`, `startup_log_file_id`, `anchors_json`). |
| planner storage | Ticket-to-workspace association when the workspace was created by a planner ticket attempt.                                                   |
| `files`         | Stores startup log content (`file_kind: startup_log`) when a startup script produces output.                                                  |

---

## Exit Codes

- `0`: command completed successfully.
- `1`: command failed (validation, API, git, or merge error).
