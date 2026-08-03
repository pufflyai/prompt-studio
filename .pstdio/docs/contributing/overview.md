This project is a Bun + TypeScript monorepo using workspaces, Lerna, and Nx caching. Local application development runs in Docker so each checkout gets an isolated database and ports.

## Prerequisites

- Bun `>=1.3.13`
- Docker

## Install

```bash
bun install
```

## Run Locally

Start an isolated API, dashboard, database, and seeded project:

```bash
bun run dev:isolated
```

The command prints the dashboard URL and the commands for following logs and stopping that stack. Pass a name when you want to reuse the same stack identifier:

```bash
bun run dev:isolated -- --name my-feature
bun run dev:isolated -- --name my-feature --logs
bun run dev:isolated -- --name my-feature --down
```

Run the landing page separately when working on it:

```bash
bun run dev:landing-page
```

## Playwright Validation

Start the fixed-name isolated stack used for manual Playwright validation:

```bash
bun run dev:playwright
```

Open the dashboard URL printed by the command, complete the browser checks, and tear down the stack afterward:

```bash
bun run dev:playwright:down
```

Run the automated end-to-end suite with:

```bash
bun run test:e2e
```

Agent-specific end-to-end behavior, including `E2E_AGENTS` and when real Claude or OpenCode sessions start, is documented in [Tests](/contributing/tests).

## CLI

The installed executable is available as either `pst` or `pstdio`. Discover the current commands through its built-in help:

```bash
pst --help
```

To run the CLI directly from a source checkout:

```bash
bun run --cwd packages/pstdio pstdio -- --help
```

See the [CLI product documentation](/product/cli/setup) for runtime setup and the command-specific guides under `.pstdio/docs/product/cli/` for supported workflows.

## Database Development

The database package is `packages/pstdio-db`. Generate and apply Drizzle migrations from the repository root:

```bash
bun run --cwd packages/pstdio-db db:generate
bun run --cwd packages/pstdio-db db:migrate
```

Inspect the configured PGlite database with Drizzle Studio:

```bash
bun run --cwd packages/pstdio-db studio
```

Do not run Drizzle Studio against the live database while `pst` is running. Stop `pst` first or inspect a copied database, as described in [PGlite WAL corruption](/lessons-learned/pglite_wal_corruption).

## Storybook

Run the UI Storybook locally:

```bash
bun run storybook:ui
```

Build the static Storybook files or run component tests:

```bash
bun run --cwd packages/ui build-storybook
bun run --cwd packages/ui test-storybook
```

See `packages/ui/README.md` for UI-package Storybook guidance.

## Project Validation

Run the repository validation suite after code changes:

```bash
bun run validate
```
