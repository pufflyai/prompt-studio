---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Projects

## Summary

This PRD documents project lifecycle commands for create, link, list, unlink, and view, including repo registration behavior.

## Detailed Behavior


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
| `name` | `string` | no       | The project name. Defaults to the current folder name. |

### Flags

| Flag     | Type       | Required | Description                                                                                     |
| -------- | ---------- | -------- | ----------------------------------------------------------------------------------------------- |
| `--repo` | `string[]` | no       | Path(s) to git repositories to connect. Repeatable. Defaults to the current repo if inside one. |

### Behavior

1. Fails if `.pstdio/config.json` already exists (project already initialized).
2. Creates the project and connects repos:
   - If `--repo` is provided, connects each specified repo path.
   - If `--repo` is omitted and the current directory is inside a git repo, connects the current repo.
   - If `--repo` is omitted and not inside a git repo, creates the project with no repos.
3. For each repo, resolves the `remote` URL from the git origin (`git remote get-url origin`). The `remote` is the canonical repo identifier. The local `path` is stored alongside it for local operations (worktree creation, etc.). If the repo has no remote, only `path` is stored.
4. Reuses the existing `repos` row if one matches by `remote` (preferred) or `path`, otherwise inserts a new one, then links it via `project_repos`.
5. Writes `.pstdio/config.json` with the project ID.
6. Scaffolds starter docs at `.pstdio/docs/`.
7. Installs default skills for each configured agent.

### Output

```text
Created project "my-app" (118795c0-4abd-46bc-8888-0e59589c4e1f) and initialized .pstdio at /path/to/cwd
```

### Errors

- `"Project already initialized. Use 'pstdio projects link' to switch projects."`: `.pstdio/config.json` already exists.
- `"Not a git repository: <path>"`: a `--repo` path is not a valid git repository.

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
3. Registers the current repo (resolving `remote` from git origin).
4. When re-linking from one project ID to another, removes local `.pstdio/tickets/`.
5. Writes `.pstdio/config.json`.
6. If `.pstdio/docs/` does not exist locally, pull persisted docs. If no remote docs exist, scaffold starter docs instead.
7. Install default skills for each configured agent.

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

## `pstdio projects view`

### Usage

```sh
pstdio projects view [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Fetch the project details from the database.
3. Fetch linked repos for the project.
4. Fetch the startup script status (set or not).
5. Print all project details in a key-value format.

### Output

```text
Name:             my-app
ID:               118795c0-4abd-46bc-8888-0e59589c4e1f
Shorthand:        MA
Created:          2026-01-15
Updated:          2026-01-20

Startup script:   configured
Repos:            2 linked
```

When the startup script is not set:

```text
Startup script:   none
```

When no repos are linked:

```text
Repos:            none
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

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

| Command                                | Purpose                    |
| -------------------------------------- | -------------------------- |
| `pstdio projects startup-script set`   | Set the startup script.    |
| `pstdio projects startup-script get`   | Print the startup script.  |
| `pstdio projects startup-script save`  | Push local `.pstdio/startup.sh` to remote. |
| `pstdio projects startup-script pull`  | Refresh local `.pstdio/startup.sh` from remote. |
| `pstdio projects startup-script clear` | Remove the startup script. |

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

### `pstdio projects startup-script save`

#### Usage

```sh
pstdio projects startup-script save
```

#### Behavior

1. Reads `.pstdio/startup.sh` from the current linked project.
2. If the file has non-whitespace content, updates `projects.startup_script` with that content.
3. If the file is empty/whitespace-only, clears `projects.startup_script` to `NULL`.

#### Output

```text
Saved .pstdio/startup.sh to project startup script
```

or when empty:

```text
Saved empty .pstdio/startup.sh and cleared project startup script
```

#### Errors

- `Local startup script not found: .pstdio/startup.sh`: no local startup script file exists.

---

### `pstdio projects startup-script pull`

#### Usage

```sh
pstdio projects startup-script pull
```

#### Behavior

1. Reads `projects.startup_script` from remote storage (authoritative source).
2. If non-null, overwrites `.pstdio/startup.sh` with the remote value.
3. If null, removes local `.pstdio/startup.sh`.

#### Output

```text
Pulled startup script to .pstdio/startup.sh
```

or when remote is empty:

```text
Pulled empty startup script and removed .pstdio/startup.sh
```

---

### Integration with Workspace Creation

Startup script execution is handled by backend workspace creation (`POST /v1/tickets/{id}/attempts`), not by the CLI process itself.

That means one configured startup script behavior applies across all workspace creation entry points:

1. `pstdio workspaces create`
2. Dashboard attempt/workspace creation
3. Direct API clients calling `POST /v1/tickets/{id}/attempts`

For worktree mode, the backend behavior is:

1. Create worktree and persist workspace git metadata.
2. Read `projects.startup_script`.
3. If configured, run the script in the created worktree directory.
4. Save stdout/stderr to workspace startup log (`/v1/workspaces/{id}/startup-log`) when output exists.
5. Continue workspace creation even if the script exits non-zero.

CLI output remains the workspace creation line; startup script output is available via `pstdio workspaces startup-log --id <workspace-shorthand>`.

---

## `pstdio projects repos`

### Usage

```sh
pstdio projects repos [--project-id <project-id>]
```

### Flags

| Flag           | Type     | Required | Description                                                                 |
| -------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `--project-id` | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`. |

### Behavior

1. Resolve the project: use `--project-id` if provided, otherwise fall back to `.pstdio/config.json`.
2. Fetch all repos linked to the project via `project_repos` from the database.
3. For each repo, check whether the path exists locally on disk.
4. Output a table showing each repo's name, path, and local availability.

### Output

```text
Name              Remote                                Path                                  Local
prompt-studio     git@github.com:org/prompt-studio.git  /Users/me/Projects/prompt-studio       yes
backend-api       git@github.com:org/backend-api.git    /Users/me/Projects/backend-api         yes
infra             git@github.com:org/infra.git          /Users/me/Projects/infra               no
```

When a repo has no remote:

```text
Name              Remote   Path                                  Local
local-tools       -        /Users/me/Projects/local-tools         yes
```

If no repos are linked:

```text
No repos found for this project. Use `pstdio projects create --repo <path>` or `pstdio projects link` to connect repos.
```

### Errors

- `"No project specified. Provide --project-id or run inside a linked project."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## Local Side Effects

Both `create` and `link` write the following local files and directories:

| Path                           | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `.pstdio/config.json`          | Project configuration with `project_id`.    |
| `.pstdio/docs/navigation.json` | Documentation navigation tree.              |
| `.pstdio/docs/index.md`        | Starter documentation page.                 |
| `.<agent>/skills/`             | Bundled pstdio skills per configured agent. |

During `link`, when the existing `.pstdio/config.json` points to a different project ID, the local `.pstdio/tickets/` directory is removed before the new config is written.
