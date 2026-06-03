# Prompt Studio Extensions

This folder contains first-party extensions for Prompt Studio. Each subfolder ships an `extension.ts` entrypoint, optional `package.json` deps, and any templates/skills/webview assets the extension contributes.

## Installing an Extension

Use `pstdio extensions add` to install an extension into the scope declared by its `package.json` `pstdio.scope` field. The default scope is `user`, which installs to `~/.pstdio/extensions/<install-name>/` or `$PSTDIO_HOME/extensions/<install-name>/` if set. `repo` scope installs to `<repo>/.pstdio/extensions/<install-name>/` and must be run inside a linked repo.

### From a local folder

```bash
pstdio extensions add ./extensions/extension-lab
```

This:

1. Copies the source to the user or repo extension root, skipping `node_modules`, `.git`, `dist`, `.turbo`, `.next`.
2. Runs a package manager (`bun`, `yarn`, or `npm`) inside the installed folder when a `package.json` is present (skip with `--skip-install`). Selection: prefer the PM the extension declares (`packageManager` field, then lockfile: `bun.lock`/`bun.lockb` → bun, `yarn.lock` → yarn, otherwise npm); if that PM is not on the user's `PATH`, fall back to the first of `bun`, `yarn`, `npm` that is. If none are installed, fail with a clear message (or skip with `--skip-install`).
3. Loads the installed copy through the v2 runtime to validate the default export and report diagnostics.
4. Auto-enables the extension for the current project (when run inside one).

### From the Prompt Studio repo

```bash
pstdio extensions add <name>
```

Resolves to `https://github.com/pufflyai/prompt-studio` at `extensions/<name>` and installs to the package's declared scope.

### Flags

| Flag                    | Effect                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `--name <install-name>` | Override the install folder name.                                       |
| `--force`               | Replace an existing install at the target path.                         |
| `--skip-install`        | Skip the dependency-install step inside the installed extension folder. |

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

### Default core extensions

The API auto-installs a configured list of default extensions. Each package decides whether it lands in the user extension root or the linked repo extension root through `package.json` `pstdio.scope`. Each default entry is either a named extension (resolved from the Prompt Studio repo) or a local folder path — the latter is useful in dev to install from the in-monorepo `extensions/<name>` folder instead of fetching from GitHub. Default list:

- `pstdio-core-skills`
- `pstdio-core-templates`
- `pstdio-core-tickets`
- `pstdio-core-workspace-automations`
- `pstdio-core-worktree-automations`

Only `pstdio-core-worktree-automations` declares repo scope; the other core extensions use user scope. Subsequent project creates skip existing installs, so user edits under `~/.pstdio-dev/extensions/pstdio-core-*/` and repo-local edits under `<repo>/.pstdio/extensions/` survive across restarts.

The config shape (lives in `pstdio-api`):

```ts
type DefaultExtensionEntry =
  | string
  | {
      source: string; // named extension OR local folder path
      installName?: string; // override install folder name (== --name)
      skipInstall?: boolean; // skip bun install (== --skip-install)
      force?: boolean; // replace existing install (== --force)
    };

type DefaultExtensionsConfig = {
  defaultExtensions: DefaultExtensionEntry[];
};
```

Resolution rule (same as the CLI): if `source` starts with `./`, `../`, `/`, or `~/` it is a local path; otherwise it is a named extension resolved against `https://github.com/pufflyai/prompt-studio` at `extensions/<name>`.

Override the config by setting `PSTDIO_DEFAULT_EXTENSIONS` (JSON) — `bun run pstdio:local:add-dev` uses this to install from the monorepo:

```ts
{
  defaultExtensions: [
    { source: "./extensions/pstdio-core-skills",                 skipInstall: true },
    { source: "./extensions/pstdio-core-templates",              skipInstall: true },
    { source: "./extensions/pstdio-core-tickets",                skipInstall: true },
    { source: "./extensions/pstdio-core-workspace-automations",  skipInstall: true },
    { source: "./extensions/pstdio-core-worktree-automations",   skipInstall: true },
  ],
}
```

### Installing an extension into the dev environment

Always install through the `pstdio extensions add` command with the dev home set explicitly:

```bash
PSTDIO_HOME="$HOME/.pstdio-dev" pstdio extensions add ./extensions/extension-lab --force
```

Because `extension-lab` uses the default user scope and `PSTDIO_HOME` is set to
`~/.pstdio-dev`, this lands at
`~/.pstdio-dev/extensions/extension-lab/`.

### Workspace SDK link (until the next `@pstdio/sdk` is published)

`extension-lab` and other first-party extensions depend on `@pstdio/sdk@^<latest>`. Until that version is published to npm, the installed extension cannot resolve it from the npm registry. Finish setup with:

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

## Releasing an Extension

Extensions are versioned and tagged by Changesets. The flow:

```bash
# 1. Author writes a changeset for the extension(s) they touched
bun changeset

# 2. When ready to release, version + changelog
bun changeset version
git commit -am "chore: version packages"

# 3. Create per-package git tags (e.g. pstdio-core-skills@0.2.0) and push
bun changeset tag
git push --follow-tags
```

Users pin a specific release with:

```bash
pstdio extensions add pstdio-core-skills --ref pstdio-core-skills@0.2.0
```

## Authoring a New Extension

Minimum viable layout:

```
extensions/<name>/
  extension.ts       # default export must call `defineExtension(...)`
  package.json       # optional; declares deps + (recommended) `packageManager`
  README.md          # extension-specific docs
```

Reference: `extensions/extension-lab/` shows commands, middlewares, hooks, schedules, routes, navigation, templates, and skills.

For the full extension API surface, see [the product extension API docs](../.pstdio/docs/product/extensions/pstdio-extension-api.md). For loader internals, see [the extension runtime loader architecture doc](../.pstdio/docs/architecture/extensions-runtime.md).
