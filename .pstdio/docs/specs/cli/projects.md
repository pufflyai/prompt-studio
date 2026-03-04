# CLI Spec: `pstdio projects`

## Purpose

Manage pstdio projects. A project groups repos, docs, tickets, and agent configurations under a single ID.

---

## `pstdio projects create`

### Usage

```sh
pstdio projects create [name]
```

### Positional Arguments

| Name   | Type     | Required | Description                                            |
| ------ | -------- | -------- | ------------------------------------------------------ |
| `name` | `string` | no       | The project name. Defaults to the current repo folder. |

### Flags

None.

### Behavior

1. Must be run inside a git repository.
2. Fails if `.pstdio/config.json` already exists (project already initialized).
3. Creates the project, registers the current repo, and writes `.pstdio/config.json`.
4. Scaffolds starter docs at `.pstdio/docs/`.
5. Installs default skills for each configured agent.

### Output

```text
Created project "my-app" (118795c0-4abd-46bc-8888-0e59589c4e1f) and initialized .pstdio at /path/to/repo
```

### Errors

- `"Not inside a git repository. Run 'git init' first."`: no git root found.
- `"Project already initialized. Use 'pstdio projects link' to switch projects."`: `.pstdio/config.json` already exists.

---

## `pstdio projects link`

### Usage

```sh
pstdio projects link --project-id <project-id>
```

### Flags

| Flag           | Type     | Required | Description             |
| -------------- | -------- | -------- | ----------------------- |
| `--project-id` | `string` | yes      | The project ID to link. |

### Behavior

1. Must be run inside a git repository.
2. Fails if the project ID does not exist.
3. Registers the current repo and writes `.pstdio/config.json`.
4. If `.pstdio/docs/` does not exist locally, pull persisted docs. If no remote docs exist, scaffold starter docs instead.
5. Install default skills for each configured agent.

### Output

```text
Linked project "my-app" (118795c0-4abd-46bc-8888-0e59589c4e1f) at /path/to/repo
```

### Errors

- `"Not inside a git repository. Run 'git init' first."`: no git root found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio projects list`

### Usage

```sh
pstdio projects list
```

### Flags

None.

### Output

```text
ID                                     Name        Created
118795c0-4abd-46bc-8888-0e59589c4e1f   my-app      2026-01-15
a3b2c1d0-1234-5678-9abc-def012345678   backend     2026-02-20
```

If no projects exist:

```text
No projects found. Run `pstdio projects create [name]` to create one.
```

---

## `pstdio projects unlink`

### Usage

```sh
pstdio projects unlink
```

### Flags

None.

### Behavior

1. Must be run inside a git repository.
2. Fails if no project is currently linked (`.pstdio/config.json` does not exist).
3. Removes `.pstdio/config.json`.

### Output

```text
Unlinked project at /path/to/repo
```

### Errors

- `"Not inside a git repository."`: no git root found.
- `"No project linked. Nothing to unlink."`: `.pstdio/config.json` does not exist.

---

## `pstdio projects delete`

### Usage

```sh
pstdio projects delete <project-id>
```

### Positional Arguments

| Name         | Type     | Required | Description               |
| ------------ | -------- | -------- | ------------------------- |
| `project-id` | `string` | yes      | The project ID to delete. |

### Flags

None.

### Behavior

1. **Soft-deletes** the project by setting `deleted_at`. The project is hidden from `list` and `get` queries but data is retained.
2. Fails if the project ID does not exist (or is already deleted).
3. Does **not** remove local `.pstdio/` files. Use `pstdio projects unlink` separately if needed.

### Output

```text
Project "118795c0-4abd-46bc-8888-0e59589c4e1f" deleted.
```

### Errors

- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio projects startup-script`

A project can define a startup script that runs automatically when a new workspace is created. The script is stored in the `projects` DB table as a nullable `startup_script` text column.

### Schema Change

| Column           | Type   | Nullable | Description                                          |
| ---------------- | ------ | -------- | ---------------------------------------------------- |
| `startup_script` | `text` | yes      | Shell script content executed on workspace creation. |

### Command Summary

| Command                                 | Purpose                        |
| --------------------------------------- | ------------------------------ |
| `pstdio projects startup-script set`    | Set the startup script.        |
| `pstdio projects startup-script get`    | Print the startup script.      |
| `pstdio projects startup-script clear`  | Remove the startup script.     |

All subcommands require a linked project (`.pstdio/config.json` exists). If missing, they fail with `"Not inside a pstdio project. Run 'pstdio projects create' first."`.

---

### `pstdio projects startup-script set`

#### Usage

```sh
pstdio projects startup-script set [--file <path>]
```

#### Flags

| Flag     | Type     | Required | Description                                          |
| -------- | -------- | -------- | ---------------------------------------------------- |
| `--file` | `string` | no       | Path to a script file. If omitted, reads from stdin. |

#### Behavior

1. Reads the script content from `--file` or stdin.
2. Updates the project's `startup_script` column in the database.

#### Output

```text
Startup script set for project "my-app".
```

#### Errors

- `"File not found: <path>"`: `--file` path does not exist.

---

### `pstdio projects startup-script get`

#### Usage

```sh
pstdio projects startup-script get
```

#### Behavior

1. Reads the project's `startup_script` from the database.
2. Prints the script content to stdout.

#### Output

The raw script content, or:

```text
No startup script configured.
```

---

### `pstdio projects startup-script clear`

#### Usage

```sh
pstdio projects startup-script clear
```

#### Behavior

1. Sets `startup_script` to `NULL` in the database.

#### Output

```text
Startup script cleared for project "my-app".
```

---

### Integration with `workspace create`

After `pstdio workspace create` completes its existing steps (worktree checkout, DB metadata), it adds:

8. Reads the project's `startup_script` from the database.
9. If non-null, executes the script inside the workspace worktree directory using the user's default shell.
10. Streams script stdout/stderr to the terminal.
11. If the script exits with a non-zero code, prints a warning but does **not** fail workspace creation.

When a startup script runs successfully:

```text
Created workspace PS-12/A1 for PS-12 at .pstdio/workspaces/PS-12/A1
Running startup script...
<script output>
Startup script completed.
```

When the script fails:

```text
Created workspace PS-12/A1 for PS-12 at .pstdio/workspaces/PS-12/A1
Running startup script...
<script output>
Warning: startup script exited with code 1.
```

When no startup script is configured, output is unchanged.

---

## Local Side Effects

Both `create` and `link` write the following local files and directories:

| Path                           | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `.pstdio/config.json`          | Project configuration with `project_id`.    |
| `.pstdio/docs/navigation.json` | Documentation navigation tree.              |
| `.pstdio/docs/index.md`        | Starter documentation page.                 |
| `.<agent>/skills/`             | Bundled pstdio skills per configured agent. |
