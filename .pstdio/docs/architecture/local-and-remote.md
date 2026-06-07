# Local and Remote Projects

Each Prompt Studio project is either **local** or **remote** — never both. The mode is set at creation time and determines where data lives, how workspaces are provisioned, and where agents run. A developer can have local and remote projects simultaneously, but a single project operates in exactly one mode.

## Local Projects

A local project runs entirely on the developer's machine. The database, workspaces, and agent sessions are all local.

```
Developer Machine
├── pstdio CLI
├── pstdio API (local server)
├── PGlite DB (~/.pstdio/data/)
├── Repo clones
└── Workspaces (~/.pstdio/workspaces/*)
```

- **DB is local-only.** The PGlite database lives on the developer's machine. It is not shared or synced.
- **`repos.path`** points to the local clone on this machine. Used for worktree creation.
- **`repos.remote`** stores the git remote URL (canonical identifier). Used to match repos across machines and for future cloud provisioning.
- **Workspace creation** runs `git worktree add` against the local clone.
- **Agent sessions** run locally (e.g. Claude Code subprocess).

### Local Data Layout

```
~/.pstdio/
├── data/                     # PGlite DB
├── workspaces/
│   ├── PS-12/A1/             # Single-repo: worktree directly here
│   └── PS-13/A1/             # Multi-repo: subdirs per repo
│       ├── api/
│       └── web/
```

## Remote Projects (Future)

A remote project is hosted in the cloud. Multiple developers share the same project, database, and workspace infrastructure.

```
Cloud
├── pstdio API (hosted)
├── PostgreSQL DB (shared)
└── Workspace VMs / Containers
    ├── Cloned repos (from remote URLs)
    └── Agent sessions (cloud-hosted)

Developer Machine
├── pstdio CLI (talks to cloud API)
├── Local repo clones (optional, for swap/merge)
```

- **DB is shared.** All team members see the same projects, tickets, sessions, and workspaces.
- **`repos.remote`** is the source of truth. Cloud workspace provisioners clone repos from `remote`.
- **`repos.path`** is per-machine. Each developer's CLI stores its own local path for the repo. This enables local operations like `swap` and `merge` even when the workspace was created in the cloud.
- **Workspace creation** happens server-side: spin up a VM/container, clone repos from `remote`, create branches.
- **Agent sessions** run in the cloud workspace environment.

## What Stays the Same

Regardless of which mode a project uses:

- **Project config** lives in the DB (project name, repo list, startup script, etc.).
- **Workspace shorthand** follows the same convention (`PS-12/A1`).
- **Derived paths** follow the same convention (`~/.pstdio/workspaces/<shorthand>/`).
- **CLI commands** have the same interface. The CLI talks to the API; the API decides whether to create a local worktree or provision a cloud workspace.
- **`repos.remote`** is always the canonical repo identifier.

## Key Design Decisions

1. **`repos.path` is local-only.** It is not meaningful outside the machine that registered it. In a shared DB (remote mode), each developer needs their own path mapping. This will be handled by a separate per-user config or by auto-detecting repos from git remotes on the local filesystem.

2. **The DB schema is the same.** Local mode uses PGlite, remote mode uses PostgreSQL, but the tables and relationships are identical.

3. **Workspace creation is target-dependent.** The `target` field on workspace creation determines how the environment is provisioned:
   - `worktree` (local): `git worktree add` against local clones.
   - Future targets (e.g. `vm`, `container`): clone from `remote` in a cloud environment.
