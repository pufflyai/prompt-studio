This project is a Bun + TypeScript monorepo using workspaces, Lerna, and Nx caching. Local application development runs in Docker so each checkout gets an isolated database and ports.

## Prerequisites

- Bun `>=1.3.14`
- Docker

## Install

```bash
bun install
```

## Run Locally

Start an isolated API, dashboard, database, and seeded project. Startup builds the workbench and its dependencies before launching the API and dashboard, so extension views work from a clean checkout:

```bash
bun run dev:isolated
```

The command prints the dashboard URL and the commands for following logs and stopping that stack. Pass a name when you want to reuse the same stack identifier:

```bash
bun run dev:isolated -- --name my-feature
bun run dev:isolated -- --name my-feature --logs
bun run dev:isolated -- --name my-feature --down
```

The container runs with your host user and group IDs. Windows uses the image's
non-root user (1000:1000). Builds write into the checkout with that identity.
Tools and caches live under `/opt/bun` and `/home/bun`; run the launcher without
`sudo`.

Run the landing page separately when working on it:

```bash
bun run dev:landing-page
```

### Repair output from the old root container

Stop old containers that mount this checkout before repairing ownership. List
their names with `docker ps`, then run `docker stop <container-name>` for each.
From the repository root on Linux, repair generated output once:

```bash
repo_owner="$(id -u):$(id -g)"
for generated in \
  packages/*/dist packages/*/.publish packages/*/.cache packages/*/.temp \
  packages/*/node_modules/.vite clients/*/dist clients/*/node_modules/.vite \
  extensions/*/dist .nx __test-tmp__; do
  if [ -d "$generated" ]; then
    sudo find "$generated" -user root -exec chown --no-dereference "$repo_owner" {} +
  fi
done
```

Recreate each old stack's volumes before starting it with the new user:

```bash
bun run dev:isolated -- --name my-feature --down
bun run dev:isolated -- --name my-feature
bun run build
```

`--down` removes that stack's demo project, volumes, and isolated runtime state.
Copy any demo work you need before running it. New stacks do not need this repair.

### Desktop development

Start the Electron client against its Docker-isolated unified runtime:

```bash
bun run dev:desktop
```

The command builds the desktop renderer, creates the fixed `pstdio-desktop` Compose stack, seeds a project, and opens Electron. Runtime data stays under the ignored repository path `__test-tmp__/dev-isolated/pstdio-desktop/`, never the production `~/.pstdio` home. Closing Electron tears down the stack and its volumes.

Use `bun run dev` for the source API plus Vite dashboard and `bun run dev:isolated` for the browser-only Docker workflow. See [Desktop application foundation](/architecture/desktop) for process boundaries, packaging, sidecar validation, and troubleshooting.

Local desktop `package` and `make` commands create unsigned development builds.
Production release mode is available only through the native release workflow;
`PSTDIO_DESKTOP_RELEASE=1` fails when the host signing or notarization credentials
are incomplete. Do not place certificate files in the repository or weaken
signature checks for local convenience. See [Desktop distribution and
updates](/product/platform/desktop-distribution) for the native matrix and
required repository secrets.

After creating a local package, run its packaged smoke suite with:

```bash
bun run --cwd clients/desktop test:packaged
```

This launches the packaged application and its bundled sidecar from temporary
homes. It is not equivalent to the signed native matrix.

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

### Run `pst` from this checkout

To use the `pst` / `pstdio` commands directly, backed by your working tree:

```bash
bun install               # install dependencies
bun run build             # build packages, including the dashboard assets `pst serve` serves
bun run pstdio:local:add  # put `pst` and `pstdio` on your PATH, pointing at this checkout
pst                       # start the API and dashboard, then open the browser
```

`pstdio:local:add` installs a thin `#!/bin/sh` wrapper that runs `bun packages/pstdio/src/index.ts` from this checkout (no `--conditions` flag), so edits to CLI or API source take effect on the next `pst` run with no rebuild. What `pst serve` still loads from disk has to be built first, though: rerun `bun run build` after changing the dashboard (served from `packages/pstdio-dashboard/dist`), and regenerate Drizzle migrations after a schema change (see [Database Development](#database-development) below). The initial `bun run build` above also vendors the PGlite runtime assets and writes `packages/pstdio/src/_embed-manifest.generated.ts`, which the CLI entry imports on startup. Remove the wrapper with `bun run pstdio:local:remove`.

`pst` runs against the real `~/.pstdio` home, unlike `bun run dev:isolated` (Docker, isolated) or `bun run dev` (`~/.pstdio-dev`).

For a one-off invocation without installing the wrapper:

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
