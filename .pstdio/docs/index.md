# Prompt Studio

Prompt Studio is a local-first workspace for agent-assisted software delivery. It combines a CLI, a web dashboard, repo-local documentation, ticket files, and live sessions around the same project state.

## What it does

- **Projects** keep configuration, repositories, statuses, tags, templates, and docs under one project id.
- **Agents** can be configured once, then used from ticket, session, and workspace flows.
- **Tickets** support both local draft files and persisted project records.
- **Sessions** capture agent conversations, follow-ups, approvals, and execution history.
- **Documentation** lives in `.pstdio/docs` and is rendered in the dashboard from `navigation.json`.

## Quick start

```bash
# Install dependencies
bun install

# Create or initialize a project in the current repo
bun run --cwd packages/pstdio pstdio -- projects create <name>

# Start the local API and dashboard
bun run --cwd packages/pstdio pstdio
```

## Documentation model

Product behavior now lives under [Product](/product/overview).

- **Product** documents shipped behavior and current constraints.
- **Architecture** explains how the product is implemented.
- **Known Issues** captures active gaps.
- **Lessons Learned** records resolved failures and their takeaways.

## Local project layout

```text
.pstdio/
├── config.json        # linked project id
├── docs/              # markdown docs and navigation.json
├── tickets/           # local ticket files and artifacts
└── templates/         # project templates written through the API
```

See [Architecture](/architecture/api) and [Contributing](/contributing/overview) for implementation and workflow details.
