# Prompt Studio

Prompt Studio is a workbench where you and your agents can build and run tailored tools for your work.

## What it does

- Projects group repositories, configuration, tickets, and documentation.
- Agents connect coding tools that work in your repositories.
- Tickets track work with statuses, tags, and templates.
- Sessions keep the conversation and execution history for agent work.
- Documentation is available from both the CLI and dashboard.

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

The CLI and dashboard use the same API:

- `pst` provides terminal commands.
- The dashboard provides the web interface.

See the [Architecture](/architecture/api) and [Contributing](/contributing/overview) sections for more details.

See the [CLI command index](/product/cli/index) for the current core commands.

## Documentation layout

`.pstdio/docs/` is organized by folder and markdown files. Browse the tree directly; no separate navigation manifest is required.

| Folder             | Purpose                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `adrs/`            | Architecture Decision Records for accepted project decisions.                              |
| `architecture/`    | System boundaries, runtime flows, and package relationships.                               |
| `contributing/`    | Development workflow, testing, standards, and maintenance guidance.                        |
| `lessons-learned/` | Root cause notes for issues that took time to diagnose.                                    |
| `product/`         | User-facing guides and cookbooks for the core CLI, dashboard, SDK, and platform.            |
| `references/`      | Lookup-oriented API, SDK, workbench, endpoint, and command references.                     |

Extension documentation follows the code that owns it:

- [Extension authoring guides](../../extensions/docs/index.md) live under `extensions/docs/`.
- [Workbench references](./references/workbench/index.md) cover the public package API, navigation, and contribution ownership.
- Each first-party extension keeps its product guides in its own folder. See the [Planner extension](../../extensions/pstdio-planner/README.md).
