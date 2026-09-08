# Prompt Studio extensions

This folder contains the first-party Prompt Studio extensions. An extension can ship an `extension.ts` entrypoint, package dependencies, templates, skills, and webview assets.

## Install an extension

Use `pst extensions add` to install an extension into the scope declared by its `package.json` `pstdio.scope` field. The default scope is `user`, which installs to `~/.pstdio/extensions/<install-name>/` or `$PSTDIO_HOME/extensions/<install-name>/` if set. `repo` scope installs to `<repo>/.pstdio/extensions/<install-name>/` and must be run inside a linked repo.

### From a local folder

```bash
pst extensions add ./extensions/extension-lab
```

This:

1. Copies the source to the user or repo extension root, skipping `node_modules`, `.git`, `dist`, `.turbo`, `.next`.
2. Runs `bun install` inside the installed folder when a `package.json` is present (skip with `--skip-install`).
3. Loads the installed copy through the v2 runtime to validate the default export and report diagnostics.
4. Auto-enables the extension for the current project (when run inside one).

### From the Prompt Studio repository

```bash
pst extensions add <name>
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
pst extensions check
```

Fix errors before using the extension. Review warnings too; they call out valid but important behavior such as
`extension_icon_unknown` naming an icon the host does not ship.

`pst extensions check` validates the extension contract and the dashboard host capabilities. If an extension declares a UI surface that the current dashboard does not support, the command exits non-zero and names the missing capability plus the Prompt Studio version that first supports it when known. With `--json`, read `hostCompatibility.status`, `hostCompatibility.host`, and each diagnostic `metadata.missingCapability`.

## Local development loop

Run the development command from a linked git project while Prompt Studio is running:

```bash
pst extensions dev ./path/to/my-extension
```

The command performs one validated refresh, enables the extension for the current project, then watches the source. It uses the same ignore rules as extension installation. Source edits are copied to the installed extension through an atomic staging folder. The current package-local `node_modules` is reused when `package.json`, `bun.lock`, and `bun.lockb` are unchanged. A dependency input change runs `bun install` in the staged copy before it becomes active.

Successful refreshes print the extension and contribution IDs. Managed webview refreshes print their view IDs. Validation, registration, and build failures go to stderr with their complete diagnostics. The command keeps watching after a failure, and the last valid installed source and webview bundle stay active.

Press Ctrl+C or send SIGTERM to stop. The command waits for an active refresh to finish or abort, removes its watchers and staging folders, and leaves the last valid installed extension enabled.

| Problem | What to do |
| --- | --- |
| The command says the project is not linked | Run `pst projects create` or `pst projects link`, then start `extensions dev` from that git repo. |
| Contract or host capability validation fails | Fix the named contribution and capability. Saving the source triggers another check. |
| `bun install` fails | Fix `package.json`, `bun.lock`, `bun.lockb`, registry access, or the local dependency path. Save a dependency input to retry. |
| A webview build fails | Read the printed view ID and Bun diagnostics. The last successful bundle remains visible while you fix the source. |
| A save produces no refresh | Confirm the file is not excluded by the extension `.gitignore` or the standard extension ignore rules. |

## Develop inside this monorepo

When developing extensions inside this monorepo, you usually want them installed under `~/.pstdio-dev/` so they don't pollute your real user root.

### One-time setup

```bash
# 1. Build the SDK before running extension checks that depend on local package output.
cd packages/sdk
bun run build

# 2. Point the local pstdio CLI at the dev API and dev paths.
bun run pstdio:local:add-dev

# 3. Start the dev API + dashboard (uses ~/.pstdio-dev for db / storage / workspaces / extensions).
bun run dev
```

### Default first-party extensions

The API installs a configured list of default extensions. Packaged hosts fetch named defaults from the
Prompt Studio Git tag paired with the running host release. Source checkouts use the local
`extensions/<name>` folders so extension development stays local-first. Each package uses
`pstdio.scope` in `package.json` to select the user extension root or the linked repository's extension
root.

The default list is:

- `harness-claude-code`
- `harness-codex`
- `harness-open-code`
- `pstdio-base-themes`
- `pstdio-planner`
- `pstdio-reports`
- `pstdio-skills`

Default extensions use user scope. Subsequent project creates skip existing installs, so user edits under
`~/.pstdio-dev/extensions/pstdio-*/` survive across restarts.

The config shape (lives in `pstdio-api`):

```ts
type DefaultExtensionEntry =
  | string
  | {
      source: string; // named extension OR local folder path
      installName?: string; // override install folder name (== --name)
      ref?: string; // override the host release tag, mainly for isolated validation
      skipInstall?: boolean; // skip bun install (== --skip-install)
      force?: boolean; // replace existing install (== --force)
    };

type DefaultExtensionsConfig = {
  defaultExtensions: DefaultExtensionEntry[];
};
```

Resolution rule (same as the CLI): if `source` starts with `./`, `../`, `/`, or `~/` it is a local path; otherwise it is a named extension resolved against `https://github.com/pufflyai/prompt-studio` at `extensions/<name>`.

The dashboard lists the built-in catalog under Marketplace. An uninstalled entry stays there so the
user can install it again from the host release.

Set `PSTDIO_DEFAULT_EXTENSIONS` to JSON to override this configuration. `bun run pstdio:local:add-dev` uses the following value to install from the monorepo:

```ts
{
  defaultExtensions: [
    { source: "./extensions/pstdio-planner",        force: true },
    { source: "./extensions/pstdio-skills",         force: true },
  ],
}
```

### Watch an extension in the development environment

Use the watch command as the primary authoring loop. Run it inside the linked Prompt Studio repo:

```bash
PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions dev ./extensions/extension-lab
```

Because `extension-lab` uses user scope and `PSTDIO_HOME` is set to `~/.pstdio-dev`, each valid snapshot is published at `~/.pstdio-dev/extensions/extension-lab/`. Use `pst extensions add --force` separately for a production-like install smoke test.

### Use the workspace SDK during development

First-party extensions depend on `@pstdio/sdk`. User/global install smoke tests must run dependency
installation and leave package-local dependencies under the installed extension root.

```bash
PSTDIO_HOME="$HOME/.pstdio-dev" pst extensions dev ./extensions/extension-lab
```

Do not use `--skip-install` or link workspace `node_modules` into `~/.pstdio` for production-like
validation. If an extension needs unpublished SDK changes, keep that work in the isolated dev home
or the repo dev stack, and never treat the linked install as the global user install.

### Verify

```bash
pst extensions check
```

Should list the extension with its commands, hooks, schedules, and zero errors.

Host compatibility should be `verified` against the bundled dashboard. If a check runs without a dashboard descriptor, Prompt Studio reports `hostCompatibility.status: "unverified"`; contract validation still ran, but UI bridge support was not proven.

## Release an extension

Extensions are versioned and tagged by Changesets. The flow:

```bash
# 1. Author writes a changeset for the extension(s) they touched
bun changeset

# 2. When ready to release, version + changelog
bun changeset version
git commit -am "chore: version packages"

# 3. Create per-package git tags (e.g. pstdio-planner@0.2.0) and push
bun changeset tag
git push --follow-tags
```

Users install the catalog release with:

```bash
pst extensions add pstdio-planner
```

Use `--branch <branch>` only when testing an extension branch during development.

## Author a new extension

Minimum viable layout:

```
extensions/<name>/
  extension.ts       # default export must call `defineExtension(...)`
  package.json       # optional; declares deps + (recommended) `packageManager`
  README.md          # extension-specific docs
```

Reference: `extensions/extension-lab/` shows commands, middleware, hooks, schedules, harnesses, views, placements, navigation, templates, and skills.

### Managed webview dependencies

Declare every package imported by a managed TypeScript or JavaScript webview in the extension's `dependencies` or `peerDependencies`. `pst extensions dev` runs `bun install` in the staged installed copy when package or Bun lock inputs change. Prompt Studio reports the complete missing-package list and leaves the previous successful bundle untouched when installation or building fails.

While Prompt Studio is running, edits to a webview's local import graph, `package.json`, `bun.lock` or `bun.lockb`, and installed dependency package metadata trigger a rebuild automatically. Creating or removing a top-level dependency under `node_modules` also retries a previously failed build, so dependency fixes do not require an API restart. Repeated refreshes with unchanged inputs reuse a successful bundle or preserve the existing failure backoff.

### Local layout recovery

The dashboard stores workbench layouts in the browser profile. These layouts are not synced through the API, SDK, CLI, or extension instances.

When an extension changes, renames, or removes a view, the dashboard reconciles locally stored layouts for the selected project. Current views keep their tab order and state where possible. Removed extension views are pruned. Native dashboard views and views from other extensions are preserved.

Each enabled extension also registers a command palette action named `Reset <extension> layout`. Use it to remove that extension's local placements from the current project's stored layouts and the active workbench. The reset is local to the current browser profile.

## Documentation

- [Extension authoring guide](./docs/index.md)
- [Extension API](./docs/api.md)
- [Planner extension](./pstdio-planner/README.md)
- [Extension runtime architecture](../.pstdio/docs/architecture/extensions-runtime.md)
