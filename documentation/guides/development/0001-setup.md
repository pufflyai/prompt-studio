# Development setup

This project is a Bun + TypeScript monorepo using workspaces, Lerna, and Nx caching. Local application development runs in Docker so each checkout gets an isolated database and ports.

## Prerequisites

- Git. The isolated stack mounts the checkout's Git folder, and core extensions are downloaded with Git.
- Bun `1.4.4`, matching the root `packageManager` pin, CI, and Docker images
- Node `24` for native build tooling, desktop development, and Canvas
- Docker with the Compose v2 plugin (`docker compose version`). The isolated stack needs BuildKit and Compose 2.17 or newer, because its build uses an extra build context. Docker Desktop includes both.
- Free disk space for Docker. See [Disk space](#disk-space).

## Install

Clone the repository with Git, then run every command in this guide from the repository root. A Git worktree of the clone also works. A folder copy without Git does not: `bun run dev:isolated` asks Git for the shared Git folder and stops when there is none.

```bash
git clone https://github.com/pufflyai/prompt-studio.git
cd prompt-studio
bun install --frozen-lockfile
```

Run `bun run clean` to remove dependencies, build and release output, caches,
test reports and temporary test data, desktop packages and sidecars, and vendored
PGlite assets. Run `bun run reset` to clean, install dependencies, and rebuild.

## Daily-drive the nightly build

Maintainers run the nightly desktop build for their own daily work. A source checkout skips the compiled CLI, the bundled runtime, the updater, and migrations on existing data, so bugs in those parts only show up in packaged builds. Install the desktop app once, then run `pst update-channel nightly` or choose **Settings → Workbench → Update channel → Nightly**. The app updates to the newest nightly through the normal updater. See [Install](../getting-started/0001-install.md#choose-an-update-channel).

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

The first start of a new name builds the image, installs every dependency into empty volumes, and builds the workbench. In three first starts on an Apple Silicon Mac, the container needed 57, 171, and 176 seconds from start to seeded project; the dependency install alone took 25 to 113 seconds. The launcher waits only 90 seconds for the seeded project, so a slow first start ends with `Timed out waiting for the isolated demo project.` while the container keeps working. Watch it with `--logs`. When the log shows `Initialized empty Git repository in /workspace/project/.git/`, run the same `bun run dev:isolated -- --name <name>` command again. The second start reuses the volumes and printed the URLs after 14 to 31 seconds. Use the URLs and token from the second start; the first start's token is not saved.

The API requires a token, created for each run. Open the dashboard URL; the dashboard dev server adds the token for you. To call the API from another tool, read `apiPort` and `apiToken` from `__test-tmp__/dev-isolated/<name>/connection.json` and send `Authorization: Bearer <apiToken>`.

The container runs with your host user and group IDs. Windows uses the image's
non-root user (1000:1000). Builds write into the checkout with that identity.
Tools and caches live under `/opt/bun` and `/home/bun`; run the launcher without
`sudo`.

The container mounts the checkout, including built package files. Stop its container before rebuilding shared packages or running `verify:packages`, then start the same container and reload the browser. A running Vite server can retain imports to deleted build chunks, causing a later action such as enabling table statistics to fail. Use `docker ps` to find the container name, then `docker stop <container-name>` and `docker start <container-name>`. These commands preserve its database and project. Use `--down` only when you intend to discard the isolated state.

### Managed proxy and custom CA

Docker, not the launcher, owns proxy settings. Set the proxy in Docker Desktop (**Settings → Resources → Proxies**) or in the `proxies` section of `~/.docker/config.json`. Docker then passes it to image builds and containers. Add internal names such as `localhost` and `127.0.0.1` to the proxy's no-proxy list.

A proxy that inspects TLS signs traffic with its own certificate authority (CA). Point `NODE_EXTRA_CA_CERTS` at that CA's PEM file in the shell that starts the stack:

```bash
export NODE_EXTRA_CA_CERTS=/path/to/managed-ca.pem
bun run dev:isolated -- --name my-feature
```

The launcher copies each certificate from the file into the stack's build context, and the image adds them to the system trust store with `update-ca-certificates`. curl, Git, Bun, and `bun install` in the image then trust the proxy. The launcher prints how many certificates it added. Changing the file rebuilds the image from that step. Do not edit `infra/local/Dockerfile` for a local proxy.

The image installs Codex, OpenCode, and Claude Code while it builds. Each install needs the network. A failed download now fails its own build step, with the installer command in the error. Before, a failed `curl ... | bash` download ran an empty script and the build failed later at `claude --version`. Fix the proxy or CA setting and start again. The agents are part of the image; do not remove an installer to get past a failed build.

### Disk space

Measured on an Apple Silicon Mac for one new stack name:

| Item | Size | Removed by `--down` |
| --- | --- | --- |
| Image `<name>-prompt-studio` | 2.28 GB, of which about 0.4 GB is unique to the name | No |
| `<name>_node-modules` volume | 1.6 to 1.9 GB | Yes |
| `<name>_bun-cache` volume | 1.6 GB | Yes |
| `<name>_project` and agent volumes | Less than 1 MB | Yes |
| `__test-tmp__/dev-isolated/<name>/` in the checkout | About 110 MB | Yes |

Stacks started before the stack's volumes were named could leave their unnamed `node_modules` volume (about 1.9 GB) behind after `--down`, because Compose keeps unnamed volumes that a recreated container inherited. Find such volumes with `docker volume ls --filter dangling=true`, and check `docker volume inspect <volume>` for a creation time that matches your stack before you remove one.

Plan for about 6 GB of free Docker disk for the first stack and about 4 GB for each further stack. Check Docker's disk with `docker system df`. `--down` keeps the image and the Docker build cache, so later starts are faster. Remove the image of a name you no longer use with `docker image rm <name>-prompt-studio`. Do not run `docker system prune` or remove other stacks' images, volumes, or build cache to free space.

Each stack also gets a Docker network from Docker's default address pools. When many stacks or other projects keep networks, a new stack fails with `all predefined address pools have been fully subnetted`. Stop your own unused stacks with `--down`; do not remove other projects' networks.

### Planner timeline stress test

Start a named Docker stack with 1,000 real Planner tickets, five dependency chains in five tracks, and ticket documents larger than 1 KB:

```bash
bun run dev:planner-stress
```

Open the printed **Timeline** URL. The default saved view, **Focus 25 of 1,000**, uses a Title filter matching exactly 25 tickets. **All** shows the full plan. The complete 1,000-ticket snapshot still reaches the iframe; this exercises client-side filtering and viewport rendering. No agent sessions are started. The stack remains available until you stop it. Repeating the command resumes an interrupted seed without adding duplicate tickets.

Run the browser stress check against that stack:

```bash
bun run --cwd packages/e2e playwright install chromium
bun run test:planner-stress
```

The check confirms all 1,000 tickets are loaded, exactly 25 match the saved filter, and the full plan keeps its card window bounded. It exercises three switches between the saved filter and All, then opens the deferred details, track form, and Auto Build editor without saving changes. The JSON report includes first timeline open, plan read time, uncompressed response bytes, iframe JavaScript and stylesheet transfer bytes before first render, mounted cards, filter-switch times, and page JavaScript heap use before opening editors. The first open includes host startup and any on-demand webview build. The separate `iframeStartupMs` starts when the iframe runtime document is requested, excluding the earlier host startup. Heap use includes the host and iframe. These are observed measurements, not timing budgets.

Use `--name my-stress` with both commands for another independent stack. Follow logs or remove the default fixture with:

```bash
bun run dev:planner-stress -- --logs
bun run dev:planner-stress -- --down
```

For an automated check using a disposable packaged runtime and temporary home, run `bun run test:planner-stress -- --packaged`. It builds the host binary if needed, installs Planner normally, and removes the runtime and fixture after the check. The Docker command above is the persistent environment for manual use.

### Sign agents in inside the stack

The isolated stack, including `bun run dev:playwright`, runs agents inside its container. Each agent needs a login that the container can read. Sign in once on the host before you start a stack. The image installs these versions:

| Agent       | Version in the image                             | How the container signs in                                                 |
| ----------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Codex       | `@openai/codex` 0.160.1                          | Mounts the host `~/.codex/auth.json`                                       |
| OpenCode    | `opencode-ai` 1.18.34                            | Mounts the host `~/.local/share/opencode/auth.json`                        |
| Claude Code | Latest release from the installer, at build time | Reads `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` from the host shell |

Versions are pinned in [`infra/local/Dockerfile`](../../../infra/local/Dockerfile). OpenCode's free models need OpenCode 1.18.0 or newer.

The launcher mounts each host login file only when it exists, and prints a `Not mounted, file is missing` line for each file it skips. The stack starts without any login. Docker would otherwise create a missing file path as an empty folder on the host, which breaks a later `codex login` or `opencode auth login`. Add a login later by signing in on the host and running the same `bun run dev:isolated -- --name <name>` command again, or by signing in inside the running container. An agent without a login stays installed but cannot start sessions. Use real logins for agent acceptance checks; empty placeholder files do not prove that sessions work.

For a fresh sign-in trial, set `PSTDIO_ISOLATED_AGENT_CREDENTIALS=0` when starting the stack. This omits host login-file mounts and clears the forwarded Anthropic API key and Claude OAuth token. It does not change your host credentials. Use a new stack name so existing container credential volumes are not reused.

**Codex.** Run `codex login` on the host. The container mounts `~/.codex/auth.json` when it exists. The seeded project uses Codex but does not pick a model. Sessions start with the model Codex marks as the default for your account. A ChatGPT account can use only the models Codex lists for it.

**OpenCode.** Run `opencode auth login` on the host. The container mounts `~/.local/share/opencode/auth.json` and `~/.local/share/opencode/mcp-auth.json` when they exist. The free `opencode/*` models need no provider login. An expired OpenCode Zen key in a mounted `auth.json` still breaks them: the turn fails with "This API key has expired". Run `opencode auth login` again on the host, or remove that entry.

**Claude Code.** On macOS, Claude Code keeps its login in the Keychain, which the Linux container cannot read. Create a long-lived token on the host with `claude setup-token`, then export it in the shell that starts the stack:

```bash
export CLAUDE_CODE_OAUTH_TOKEN=<token from claude setup-token>
bun run dev:playwright
```

Compose passes `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` into the container only when they are set on the host. You can also sign in inside a running stack. The login is kept in the stack's `claude-config` volume until you run `--down`:

```bash
docker exec -it <stack-name>-prompt-studio-1 claude
# then type /login and follow the prompts
```

For `bun run dev:playwright`, the stack name is `pstdio-playwright`.

Build and serve the landing page separately in Docker when working on it. From the repository root:

```bash
docker build -f clients/landing-page/Dockerfile -t pstdio-landing-preview .
docker run -d --name pstdio-landing-preview -p 127.0.0.1::80 \
  -v "$PWD/clients/landing-page/public/images:/usr/share/nginx/html/images:ro" \
  pstdio-landing-preview
docker port pstdio-landing-preview 80
```

Open the loopback address printed by `docker port`. Rebuild the image and recreate the container after source changes. Stop and remove it with `docker rm -f pstdio-landing-preview`. This preview serves static files and uses no dashboard runtime or database. See the [landing page README](../../../clients/landing-page/README.md#isolated-preview).

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

Use `bun run dev:isolated` for the browser-only Docker workflow. See [Desktop application foundation](../../references/architecture/0006-desktop.md) for process boundaries, packaging, sidecar validation, and troubleshooting.

Local desktop `package` and `make` commands create unsigned development builds.
Production release mode is available only through the native release workflow;
`PSTDIO_DESKTOP_RELEASE=1` fails when the host signing or notarization credentials
are incomplete. Do not place certificate files in the repository or weaken
signature checks for local convenience. See [Desktop distribution and
updates](../../requirements/platform/0002-desktop-distribution.md) for the native matrix and
required repository secrets.

After creating a local package, run its benchmarks and packaged smoke suite with:

```bash
bun run --cwd clients/desktop test:benchmark
bun run --cwd clients/desktop test:packaged
```

This launches the packaged application and its bundled sidecar from temporary
homes. It is not equivalent to the signed native matrix.

## Playwright Validation

Start the fixed-name isolated stack used for manual Playwright validation:

```bash
bun run dev:playwright
```

Open the dashboard URL printed by the command, complete the browser checks, and tear down the stack afterward. To run agent sessions in this stack, sign the agents in first, as described in [Sign agents in inside the stack](#sign-agents-in-inside-the-stack):

```bash
bun run dev:playwright:down
```

Run the end-to-end spec for the behavior you changed:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/<name>.spec.ts
```

## Run isolated trials

A trial is one validation run, for example a fresh-agent walkthrough or a reproduction. Give every trial its own name and keep everything it creates under that name, so trials cannot share state and cleanup removes only their own resources.

| Resource | How a trial gets its own copy |
| --- | --- |
| Runtime home | `bun run dev:isolated -- --name <trial>` uses `__test-tmp__/dev-isolated/<trial>/pstdio-home`. Packaged tests and `pst extensions test` take a temporary `PSTDIO_HOME`. Never use `~/.pstdio`. |
| Docker stack | The name is the Compose project name. Its containers, network, and volumes start with `<trial>`. Relay and account fixtures print their own run names, `pstdio-relay-test-<uuid>` and `manager-authority-<uuid>`. |
| Ports | The launcher reserves free loopback ports for each start and writes them to `__test-tmp__/dev-isolated/<trial>/connection.json`. Fixtures publish no host ports. |
| Fixture networks | Fixtures use fixed subnets: `SYNC_TEST_SUBNET` (default `10.254.236.0/24`), `RELAY_TEST_SUBNET` (`10.254.237.0/24`), and `MANAGER_TEST_SUBNET` (`10.254.234.0/24`). Run one fixture at a time, or give parallel trials different subnets after checking `docker network inspect` for unused ones. |
| Projects | Each stack seeds its own `project` folder in a volume. Create further projects inside the trial's stack, not in your own folders. |
| Browsers | Set `PLAYWRIGHT_BROWSERS_PATH` to a new folder to prove a clean browser install. See [Tests](0002-testing.md#extension-smoke-checks). |
| Agent logins | Mounted from the host only when they exist. Never copy credentials into evidence. |

Before teardown, save what the trial needs as evidence:

1. Save the trial's source changes: `git status` and `git diff` in the checkout, or commit them on a branch.
2. Save logs: `docker compose -p <trial> logs --no-color > <evidence>/stack.log` and the files under `__test-tmp__/dev-isolated/<trial>/pstdio-home/`.
3. Copy project files you need: `docker cp <trial>-prompt-studio-1:/workspace/project <evidence>/project`.
4. Leave out `connection.json` and any login file. They contain tokens.

Then stop the trial with `bun run dev:isolated -- --name <trial> --down`. It removes the trial's containers, network, volumes, and `__test-tmp__/dev-isolated/<trial>/`. Remove its image with `docker image rm <trial>-prompt-studio` when you no longer need it. Fixture runners remove their own stacks after success or failure. List what is left with `docker ps -a --filter label=com.docker.compose.project=<trial>` and `docker volume ls --filter label=com.docker.compose.project=<trial>`. Remove only resources with your trial's name.

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
pst --help                # inspect CLI help; use the isolated stack for development
```

`pstdio:local:add` installs a thin `#!/bin/sh` wrapper that runs `bun packages/pstdio/src/index.ts` from this checkout (no `--conditions` flag), so edits to CLI or API source take effect on the next `pst` run with no rebuild. What `pst serve` still loads from disk has to be built first, though: rerun `bun run build` after changing the dashboard (served from `packages/pstdio-dashboard/dist`), and regenerate Drizzle migrations after a schema change (see [Database Development](#database-development) below). The initial `bun run build` above also vendors the PGlite runtime assets and writes `packages/pstdio/src/_embed-manifest.generated.ts`, which the CLI entry imports on startup. Remove the wrapper with `bun run pstdio:local:remove`.

`pst` runs against the real `~/.pstdio` home, unlike `bun run dev:isolated` (Docker, isolated).

For a one-off invocation without installing the wrapper:

```bash
bun run --cwd packages/pstdio pstdio -- --help
```

See [runtime commands](../../references/cli/0003-setup.md) for how the runtime starts and stops, and the other [CLI references](../../references/cli/0001-overview.md) for each command group. The user install steps are in [Install Prompt Studio](../getting-started/0001-install.md).

## Database Development

The database package is `packages/pstdio-db`. Generate Drizzle migrations from the schema source:

```bash
bun run --cwd packages/pstdio-db db:generate
```

Never edit generated SQL by hand. Keep one migration entry per PR. Verify migrations through isolated test/startup workflows. Do not connect directly to the local PGlite database or run Drizzle Studio against production state. Use public APIs for inspection. See [PGlite ownership and recovery](../../lessons-learned/0002-pglite-wal-corruption.md).

## Canvas

Use the live Canvas extension for designs and component examples. See the [authoring and coverage guide](0003-canvas-coverage.md).

Start the watcher in its own terminal. It keeps running until you stop it, and UI Canvas shows what it builds:

```sh
bun run canvas
```

In another terminal:

```sh
pst canvas list
pst canvas open --canvas packages/ui/src/foundations/foundations.canvas.tsx
```

Run the critical Canvas browser checks with `bun run --cwd packages/canvas-tests test` in the isolated Docker tools container.

## Project Validation

Run the smallest relevant test scope and package checks for the behavior you changed. Include affected callers when a change crosses package boundaries. For documentation-only edits, check content, links, paths, and formatting; application tests are not needed. See [targeted validation](0002-testing.md#validation) for commands.

## Pull request area labels

See [Pull request area labels](0004-pull-request-labels.md) for automatic review labels, SDK and extension separation, and workflow rollout.
