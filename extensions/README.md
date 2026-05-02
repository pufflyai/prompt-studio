# Prompt Studio Extensions

This folder contains first-party v2 extensions for Prompt Studio. Each subfolder ships an `extension.ts` entrypoint, optional `package.json` deps, and any templates/skills/webview assets the extension contributes.

## Installing an Extension

Use `pstdio extensions add` to install an extension into your Prompt Studio user root (default: `~/.pstdio/extensions/<install-name>/`, or `$PSTDIO_HOME/extensions/<install-name>/` if set).

### From a local folder

```bash
pstdio extensions add ./extensions/extension-lab
```

This:

1. Copies the source to `<install-root>/extension-lab/`, skipping `node_modules`, `.git`, `dist`, `build`, `.turbo`, `.next`, `coverage`, and common cache dirs.
2. Runs the package manager (`npm` by default; `bun` if a `bun.lock`/`bun.lockb` exists or `packageManager` says so) when a `package.json` is present.
3. Loads the installed copy through the v2 runtime to validate the default export and report diagnostics.

### From the Prompt Studio repo (published catalog)

```bash
pstdio extensions add <name>
```

Resolves to `https://github.com/pufflyai/prompt-studio` at `extensions/<name>` and installs to `<install-root>/<name>/`.

### Flags

| Flag                    | Effect                                          |
| ----------------------- | ----------------------------------------------- |
| `--name <install-name>` | Override the install folder name.               |
| `--force`               | Replace an existing install at the target path. |
| `--ref <git-ref>`       | Repo ref for named installs (default `main`).   |
| `--install=<npm\|bun>`  | Force a specific package manager.               |
| `--skip-install`        | Skip the dependency-install step.               |

After install, verify with:

```bash
pstdio extensions check
```

## Dev Workflow (in-monorepo)

When developing extensions inside this monorepo, you usually want them installed under `~/.pstdio-dev/` so they don't pollute your real user root.

### One-time setup

```bash
# 1. Build the SDK and register a global link so installed extensions can resolve
#    `@pstdio/sdk` from the workspace until the next version is published.
cd packages/sdk
bun run build
npm link

# 2. Point the local `pstdio` CLI at the dev API and dev paths.
bun run pstdio:local:add-dev

# 3. Start the dev API + dashboard (uses ~/.pstdio-dev for db / storage / workspaces / extensions).
bun run dev
```

### Installing an extension into the dev environment

```bash
pstdio extensions add ./extensions/extension-lab
```

Because `pstdio:local:add-dev` exports `PSTDIO_HOME=~/.pstdio-dev`, this lands at `~/.pstdio-dev/extensions/extension-lab/`.

### Workspace SDK link (until the next `@pstdio/sdk` is published)

`extension-lab` and other first-party extensions depend on `@pstdio/sdk@^<latest>`. Until that version is published to npm, `npm install` inside the install dir cannot resolve it; the install will fail at the dep step but **the source is preserved**. Finish setup with:

```bash
cd ~/.pstdio-dev/extensions/extension-lab
npm link @pstdio/sdk
```

This swaps in the workspace `@pstdio/sdk` (which has the `./extensions` subpath the extension imports from). After the next SDK release lands on npm, the manual `npm link` step is no longer required.

### Verify

```bash
pstdio extensions check
```

Should list the extension with its commands, hooks, schedules, and zero errors.

## Authoring a New Extension

Minimum viable layout:

```
extensions/<name>/
  extension.ts       # default export must call `defineExtension(...)`
  package.json       # optional; declares deps + (recommended) `packageManager`
  README.md          # extension-specific docs
```

Reference: `extensions/extension-lab/` shows commands, middlewares, hooks, schedules, routes, navigation, templates, and skills.

For the full extension API surface, see [`extensions/docs/pstdio-extension-api.md`](docs/pstdio-extension-api.md) and [`extensions/docs/extension-runtime.md`](docs/extension-runtime.md).
