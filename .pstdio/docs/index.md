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

# Initialize a project
bun run --cwd packages/cli pstdio projects create <name>

# Launch the dashboard
bun run dev:dashboard

# Launch the API
bun run dev:api
```

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

- **CLI** (`pstdio`) — terminal commands
- **Dashboard** — web-based UI

See the [Architecture](/architecture/api) and [Contributing](/contributing/overview) sections for more details.
