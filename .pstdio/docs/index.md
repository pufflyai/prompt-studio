# Prompt Studio

Prompt Studio is a local-first project management tool for AI-driven development. It runs as a CLI and web dashboard.

## What it does

- **Projects** — organize work into isolated projects, each with its own configuration, tickets, and documentation.
- **Agents** — define and manage AI coding agents that operate on your codebase.
- **Tickets** — track tasks with statuses, tags, and templates, all stored as local files.
- **Sessions** — capture agent work sessions with full history.
- **Documentation** — write and browse project docs from the CLI or dashboard.

## Quick start

```bash
# Install dependencies
bun install

# Start an isolated API, dashboard, database, and seeded project
bun run dev:isolated
```

For manual browser validation, use `bun run dev:playwright` and tear down the stack afterward with `bun run dev:playwright:down`. See [Contributing](/contributing/overview) for the full local workflow.

## Architecture

Prompt Studio follows a local-first architecture. All data lives in your repo under `.pstdio/` and can optionally sync to a remote Postgres database via Electric SQL.

```
.pstdio/
├── config.json        # project configuration
├── docs/              # markdown documentation
├── tickets/           # ticket files
└── templates/         # ticket templates
```

Two surfaces consume the same API:

- **CLI** (`pst`) — terminal commands
- **Dashboard** — web-based UI

See the [Architecture](/architecture/api) and [Contributing](/contributing/overview) sections for more details.

## Documentation Layout

`.pstdio/docs/` is organized by folder and markdown files. Browse the tree directly; no separate navigation manifest is required.

| Folder | Purpose |
| ------ | ------- |
| `adrs/` | Architecture Decision Records for accepted project decisions. |
| `architecture/` | System boundaries, runtime flows, and package relationships. |
| `contributing/` | Development workflow, testing, standards, and maintenance guidance. |
| `lessons-learned/` | Root cause notes for issues that took time to diagnose. |
| `product/` | User-facing guides and cookbooks for CLI, dashboard, SDK, hooks, platform, and extensions. |
| `references/` | Lookup-oriented API, SDK, workbench, endpoint, and command references. |
