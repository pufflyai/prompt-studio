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

If page or panel arrangement looks broken while iterating, run the extension's dashboard command "Reset <extension> layout" from the command palette. It reseeds the extension's pages and placements from the current declarations. There is no CLI reset; layout state is per-browser, and titles and tab identity are never persisted, so a reload plus the reset command covers every stale-layout case.

## Install and runtime smoke test

Install the extension source into a throwaway Prompt Studio home and validate loaded contributions:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions add <path-to-extension> --force
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions check
```

Treat warnings as actionable. They do not block loading, but they describe behavior an author should confirm.

Page diagnostics to expect:

- `extension_page_slot_duplicate`: a slot id is declared twice on one page.
- `extension_page_slot_invalid`: a static slot sets bound-only fields (`cardinality`, `follows`), a bound slot sets static-only fields (`defaultOpen`, `scope`), or a `many` slot is outside the panel regions (`main`, `side`, `secondary`).
- `extension_page_binding_invalid`: a binding targets a slot that is not a bound slot on the page, or binds the same resource kind to the same slot twice.
- `extension_page_follows_invalid`: `follows` names a slot that is not a `many` slot on the same page, or the follower binds none of that slot's resource kinds.
- `extension_page_path_invalid`: a page path is not lowercase kebab-case segments separated by `/`, collides with a reserved host segment (`workspaces`, `sessions`), or repeats another page path in the extension.
- `extension_page_missing`: a page target names an unknown page. Own pages and host pages (`workbenchPages.*`) must resolve; refs into other extensions are shape-checked only.
- `extension_page_target_invalid`: a page target names a slot the page does not have, or a resource whose kind the target page does not bind (host pages are validated against their published kinds).
- `extension_page_scope_inert` (warning): a slot declares `scope: "location"` on a page with no bindings, so its location never changes.

Composition diagnostics to expect:

- `extension_view_missing`: a page slot or binding references an unknown view.
- `extension_resource_kind_missing`: a binding, palette provider, or hierarchy provider references an unknown resource kind.
- `invalid_placement`: a required placement sets `defaultOpen: false`, or `movableTo` omits the initial region.
- `duplicate_view_placement`: a mode places the same view more than once.
- `removed_extension_contribution` (error): the manifest declares a removed contribution such as `resourceViews`; the message names the replacement (a page with `bindings`).

Convention diagnostics to expect:

- `extension_icon_unknown`: an icon name is not in the host icon set.
- `extension_contribution_id_invalid` (error): a local contribution id is outside the grammar of lowercase kebab-case segments separated by dots, such as `ticket-status.create`.
- `extension_command_reference_missing`: a contribution references a command that does not exist.
- `conflicting_translation_default` (warning): one `l10n()` key declares two different defaults. Only the first
  reaches the bundle, so the other copy never appears. Give each piece of copy its own key.

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

If the dashboard layout looks stale after contribution changes, run the extension's layout reset command
from the command palette. It appears in the `Extensions` group as `Reset <extension> layout`
(command id `dashboard.extensions.resetLayout.<extension-id>`) and clears the persisted layout for that
extension only.

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
