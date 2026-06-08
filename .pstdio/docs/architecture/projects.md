# Projects

A project is the top-level container in pstdio. It groups repos, docs,
templates, workspaces, sessions, agent configurations, and enabled extensions
under a single ID.

Planner tickets are project-scoped, but they are stored by the
`pstdio-planner` extension rather than core project tables.

## Data Model

```
┌──────────────┐        ┌───────────────┐        ┌────────────┐
│   projects   │───1:N──│ project_repos │──N:1───│   repos    │
└──────┬───────┘        └───────────────┘        └────────────┘
       │
       │ 1:N
       ├──── workspaces
       ├──── files
       ├──── templates
       ├──── project_extension_instances
       └──── ydoc_updates
```

### Tables

| Table           | Purpose                                       |
| --------------- | --------------------------------------------- |
| `projects`      | Core project record (name, shorthand, dates). |
| `repos`         | Git repositories (name, path, remote).        |
| `project_repos` | Junction table linking projects to repos.     |

A project can have zero or more repos. The `project_repos` junction table uses cascade deletes on both sides — deleting a project removes all links, deleting a repo unlinks it from all projects.

## Creation Flow

When a project is created (`pst projects create`), the following happens in order:

```
CLI                              API                         DB
 │                                │                           │
 │  POST /projects                │                           │
 │───────────────────────────────►│  INSERT projects          │
 │                                │──────────────────────────►│
 │                                │  INSERT templates         │
 │                                │──────────────────────────►│
 │                                │  enable default extensions│
 │                                │──────────────────────────►│
 │  POST /projects/{id}/repos     │  (for each repo)          │
 │───────────────────────────────►│  UPSERT repos             │
 │                                │  INSERT project_repos     │
 │                                │──────────────────────────►│
 │                                │                           │
 │  write .pstdio/config.json     │                           │
 │  scaffold .pstdio/docs/        │                           │
 │  seed bundled templates        │                           │
 │  install default skills        │                           │
```

1. **Create the project** — `POST /projects` inserts the project row and seeds core project defaults such as templates.
2. **Register repos** (optional) — for each repo (`--repo` flag, or auto-detected from cwd), resolves the `remote` URL from `git remote get-url origin` (canonical identifier) and the local `path`. `POST /projects/{id}/repos` reuses the existing `repos` row if one matches by `remote` (preferred) or `path`, otherwise inserts a new one, then links it via `project_repos`. If the local `.pstdio/config.json` points to a different active project, the API returns `409`. If it points to a project that no longer exists, the API treats it as stale state, clears `.pstdio/tickets/`, and rewrites `.pstdio/config.json` for the new project. If no repos are specified and the command is not run inside a git repo, this step is skipped.
3. **Write local config** — `.pstdio/config.json` is written with the `project_id`.
4. **Scaffold docs** — starter docs are created at `.pstdio/docs/`.
5. **Seed templates** — bundled templates are uploaded to the project.
6. **Enable extensions** — default extensions, including planner when configured, are installed/enabled for the project.
7. **Install skills** — default skills are installed for each configured agent.

## Linking Additional Repos

A project can span multiple repos. Use `pst projects link --project-id <id>` from a different repo to add it to an existing project. This registers the new repo and writes `.pstdio/config.json` in that repo. When linking switches the local repo from one project ID to another, `.pstdio/tickets/` is removed to avoid carrying stale local ticket files into the new project.

## Soft Deletes

Projects use soft deletes (`deleted_at` column). A deleted project is hidden from `list` and `get` queries but data is retained. Cascade deletes on child tables only trigger on hard deletes.

## Rules

1. **Repos are optional.** A project can exist without repos. Repos can be added later via `--repo` or `pst projects link`.
2. **Repos are linked, not embedded.** The junction table allows many-to-many relationships — one repo can belong to multiple projects.
3. **All project data goes through the API.** Only local config (`.pstdio/config.json`, `.pstdio/docs/`) is written directly to the filesystem.
4. **Core side-effect rows are streamed.** Core rows such as templates are emitted as `sync:set` events so connected clients stay in sync. Planner ticket/status/tag state is loaded through planner commands.
