# Extension validation

## TDD loop

For behavior changes, reproduce the issue or missing behavior first:

1. Add the smallest test that proves the extension behavior.
2. Run the focused test and confirm it fails for the expected reason.
3. Implement the minimum code needed.
4. Re-run the focused test until green.
5. Refactor and re-run tests.

Skip tests for docs-only, config-only, generated wording, and UI-only changes. For UI changes, add or update stories
and use e2e checks when behavior changes.

## Focused checks

Use Bun commands only.

```bash
bun test <path-to-test>
bun run --cwd <path-to-extension> typecheck
```

Run the extension typecheck only when the extension package has that script. For first-party extension behavior, prefer
tests next to the relevant extension file or in the package that owns the runtime behavior.

## Local development loop

Run Prompt Studio and start the extension watcher from a linked git project:

```bash
pst extensions dev <path-to-extension>
```

The first cycle checks the extension contract and dashboard host capabilities, publishes a valid installed snapshot, enables it for the current project, and reports contribution and webview IDs. Later source saves refresh that snapshot. Changes to `package.json`, `bun.lock`, or `bun.lockb` run `bun install` before refresh. Errors stay in the terminal and do not stop the watcher or replace the last valid snapshot.

Stop with Ctrl+C. The command removes watchers and temporary staging folders but leaves the last valid extension enabled.

## Install and runtime smoke test

Install the extension source into a throwaway Prompt Studio home and validate loaded contributions:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions add <path-to-extension> --force
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions check
```

Treat warnings as actionable. They do not block loading, but they describe behavior an author should confirm.

Composition diagnostics to expect:

- `invalid_placement`: a placement uses an invalid region or item, or still declares a removed field such as `defaultOpen`, `required`, `closable`, `defaultResource`, `openCommand`, `regionSize`, or `regionCollapsible`. The message names the replacement, for example `presence` on the static item, `add` on the resource binding, or `regionSettings` on the owning mode.
- `invalid_page` and `invalid_page_slot`: a page field or slot shape is invalid, or a slot still declares one of the removed fields above (or a slot-level `cardinality`). The message names the replacement field.
- `invalid_mode`: a mode is missing a label or valid regions, or its `regionSettings` keys are not declared regions.
- `invalid_keybinding`: a keybinding chord is invalid or the contribution declares no navigation `action`.
- `extension_page_primary_invalid`: a page does not declare exactly one primary slot in `main`, or a resource page has no `parent`.
- `extension_page_region_invalid`: a page slot targets a region its mode does not expose.
- `extension_resource_kind_missing` and `extension_view_missing`: a binding or hierarchy provider references an unknown resource kind or view.
- `extension_resource_menu_slot_closed`: an external command targets a closed resource menu slot.

Convention diagnostics to expect:

- `extension_icon_unknown`: an icon name is not in the host icon set.
- `extension_contribution_id_invalid` (error): a local contribution id is outside the grammar — lowercase kebab-case segments separated by dots, such as `ticket-status.create`.
- `extension_command_reference_missing`: a contribution references a command that does not exist.

Do not pass `--skip-install` for a user/global install smoke test. The install must create package-local
dependencies under the installed extension root so the packaged runtime does not depend on workspace
`node_modules` symlinks or repo paths under `~/Documents`.

If the extension contributes CLI commands, inspect the generated help and run a happy-path command:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst <extension-name> --help
PSTDIO_HOME="$HOME/.pstdio-smoke" pst <extension-name> <command> --help
```

If dashboard UI or webviews must be checked, start the dashboard against the same throwaway home:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst
```

Then exercise the route, menu item, settings panel, renderer, or command palette entry in the dashboard.

Inspect what the host actually loaded before clicking through the UI:

- Open the extension in project settings and check its contributions tab. It lists every declared
  contribution and its diagnostics, even while the extension is disabled.
- For scripted checks, the same data is served by
  `GET /v1/projects/{projectId}/extensions/{instanceId}/contributions`.

## Packaged artifacts

When bundled runtime artifacts change, such as extension skills, templates, prompts, themes, or packaged defaults,
reinstall the extension and confirm the packaged asset set still loads:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions add <path-to-extension> --force
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions check
```

Keep any packaged smoke-test expectations aligned with the current bundled artifact set.

## Final validation

Before handoff for non-documentation changes, run the full validation command your project defines
(for example `bun run validate`). If validation cannot run, record the exact command, failure, and reason.
