# CLI: `pstdio projects`

Manage pstdio projects. A project groups repos, docs, tickets, and agent configurations under a single ID.

---

## `pstdio projects create`

Create a new project and initialize `.pstdio` in the current git root.

```
pstdio projects create [name]
```

**Positional arguments:**

| Name   | Type     | Required | Description                                            |
| ------ | -------- | -------- | ------------------------------------------------------ |
| `name` | `string` | no       | The project name. Defaults to the current repo folder. |

**Flags:** none

**Behavior:**

1. Must be run inside a git repository.
2. Fails if `.pstdio/config.json` already exists (project already initialized).
3. Creates the project, registers the current repo, and writes `.pstdio/config.json`.
4. Scaffolds starter docs at `.pstdio/docs/`.
5. Installs default skills for each configured agent.

**Output:**

```
Created project "my-app" (118795c0-4abd-46bc-8888-0e59589c4e1f) and initialized .pstdio at /path/to/repo
```

**Errors:**

- `"Not inside a git repository. Run 'git init' first."` — no git root found.
- `"Project already initialized. Use 'pstdio projects link' to switch projects."` — `.pstdio/config.json` already exists.

---

## `pstdio projects link`

Link an existing project to the current git root.

```
pstdio projects link --project-id <project-id>
```

**Flags:**

| Flag           | Type     | Required | Description             |
| -------------- | -------- | -------- | ----------------------- |
| `--project-id` | `string` | yes      | The project ID to link. |

**Behavior:**

1. Must be run inside a git repository.
2. Fails if the project ID does not exist.
3. Registers the current repo and writes `.pstdio/config.json`.
4. If `.pstdio/docs/` does not exist locally, pulls persisted docs. If no remote docs exist, scaffolds starter docs instead.
5. Installs default skills for each configured agent.

**Output:**

```
Linked project "my-app" (118795c0-4abd-46bc-8888-0e59589c4e1f) at /path/to/repo
```

**Errors:**

- `"Not inside a git repository. Run 'git init' first."` — no git root found.
- `"Project not found: <project-id>"` — the given project ID does not exist.

---

## `pstdio projects list`

List all projects.

```
pstdio projects list
```

**Flags:** none

**Output:**

```
ID                                     Name        Created
118795c0-4abd-46bc-8888-0e59589c4e1f   my-app      2026-01-15
a3b2c1d0-1234-5678-9abc-def012345678   backend     2026-02-20
```

If no projects exist:

```
No projects found. Run `pstdio projects create [name]` to create one.
```

---

## Local Side Effects

Both `create` and `link` write the following to the local filesystem:

| Path                            | Description                                |
| ------------------------------- | ------------------------------------------ |
| `.pstdio/config.json`          | Project configuration with `project_id`.   |
| `.pstdio/docs/navigation.json` | Documentation navigation tree.             |
| `.pstdio/docs/index.md`        | Starter documentation page.                |
| `.<agent>/skills/`             | Bundled pstdio skills per configured agent. |
