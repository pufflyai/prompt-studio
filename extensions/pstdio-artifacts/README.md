# pstdio-artifacts

A global Prompt Studio extension for publishing self-contained HTML pages. Install it explicitly once in user scope; it is not installed by default. Each project has its own library and immutable revision history.

## Agent API

```sh
pst pstdio-artifacts publish --file_path ./dist/index.html --favicon '📦' --label 'First draft' --json
pst pstdio-artifacts publish --file_path ./dist/index.html --url '<returned url>' --label 'Updated' --json
pst pstdio-artifacts list --json
pst pstdio-artifacts read --url '<returned url>' --json
pst pstdio-artifacts revisions --url '<returned url>' --json
pst pstdio-artifacts open --url '<returned url>' --json
pst pstdio-artifacts rename --url '<returned url>' --name 'New name' --json
pst pstdio-artifacts delete --url '<returned url>' --json
```

The input names follow Anthropic's artifact publishing tool: `file_path`, optional `favicon`, `label`, and `url`. The returned `url` identifies a saved artifact. Omit `url` to create a new artifact; provide it to append a revision. The result also includes `artifactId`, `revisionId`, `title`, a resource reference, and a dashboard navigation target. `open` returns a navigation target for callers to open.

With `--json`, the CLI returns that result under `outcome.value`. The packaged `publish-artifact` skill explains the workflow to agents.

## Dashboard

Open **Artifacts** in the project navigation. The library shows a responsive grid of page thumbnails, artifact names, and edited dates. Each whole card opens its artifact and supports keyboard navigation. Use the search field to filter the library; there are no ownership or sharing tabs.

The library stays open as an **Artifacts** tab beside each opened artifact. Switching tabs preserves the search and interactive previews. The breadcrumb stays at **Artifacts**. Published URLs open the matching artifact tab in this page.

Each artifact has one control: a dropdown named after the artifact. Use it to select versions, rename or delete the artifact, or return to the library tab. New versions appear in this menu without resetting the current preview. Rename changes the artifact's name across versions and later updates; it does not edit the saved HTML. Delete removes all published versions and their snapshots after confirmation, keeping original source files.

Agents create and update artifacts through the publish command. The dashboard is for browsing and managing saved artifacts. Publication uses the active workspace when available, otherwise the project's default repository.

## Theme-aware pages

Previews and thumbnails follow the dashboard's active theme without reloading the HTML or resetting interactive state. The body inherits its background, text color, and font. Authors can use these CSS variables for the rest of their page:

| Variable | Purpose |
| --- | --- |
| `--artifact-bg` | Page background |
| `--artifact-surface` | Cards and secondary surfaces |
| `--artifact-fg` | Main text |
| `--artifact-muted` | Captions and secondary text |
| `--artifact-border` | Borders and chart grid lines |
| `--artifact-accent` | Links and chart highlights |
| `--artifact-font` | Dashboard body font stack |

The root `data-theme` is `light` or `dark`. Standard `prefers-color-scheme` queries follow that mode. SVG/CSS visualizations using the variables update automatically; canvas renderers can observe the root's `style` attribute to redraw. Pages that set their own fixed colors keep those colors. Only theme values enter the preview; sandbox permissions remain the same.

[Weekly activity](examples/weekly-activity.ts) is a self-contained reference with a themed SVG chart, category filters, a week slider, and keyboard-accessible day selection. It uses illustrative sample data.

## Local development

Start an isolated Prompt Studio instance with `bun run dev:isolated`, then run `pst extensions dev <absolute-path>/extensions/pstdio-artifacts` from a linked project using that instance's API URL. This prototype depends on the separate platform change for SDK page URLs and webview event subscriptions (PS-58 and PS-59). Until that SDK release is available, link its locally built package with `bun link` from `packages/sdk`, then `bun link @pstdio/sdk` from this extension. For an installed smoke test outside the monorepo, use the packed SDK through the local workspace registry. The preview and theme handling are owned by this extension.

The last valid development snapshot remains installed after the watcher stops. Nothing is installed into `.pstdio/extensions` in the project.

## Prototype boundaries

- HTML and HTM only, UTF-8, up to 16 MiB. Bundle scripts, styles, and assets into the HTML. No build server, backend process, Markdown renderer, or raw React compilation.
- Titles come from the first HTML title, falling back to the filename. Emoji and revision labels are optional.
- Saved HTML runs in an opaque iframe with `allow-scripts`. A separate enclosing frame owns the content security policy and blocks remote frame navigation, including scripts, links, and meta refresh. The artifact inherits that policy and has no Prompt Studio bridge, parent DOM access, network fetches, or forms. Preview HTML travels through the existing command bridge and uses `srcdoc`; no new HTTP preview endpoint is added.
- Update and read commands accept the root-relative URL returned by publish. Browser-origin URLs are not accepted in this prototype.
- Artifact identities, revisions, names, and snapshots use project-scoped extension storage and artifact mounts. Concurrent publications create separate revisions, ordered by publication time and revision ID. Deletion removes the identity before cleaning up revisions. A publication that finishes after deletion removes its own saved files, and cannot restore the deleted URL.
- There is no sharing, public hosting, automatic retention, saved viewport preference, or external asset support. Preview state lasts while its tab stays mounted.

Run `bun test extensions/pstdio-artifacts` and `bun run --cwd extensions/pstdio-artifacts typecheck`. All component and preview stories are included in the dashboard Storybook under **Extensions/Artifacts**.

The browser tests are `packages/e2e/src/ui/artifacts.spec.ts` and `html-preview.spec.ts`. They cover agent publication, project separation, preview isolation and blocked navigation, theme changes without losing state, search, library and artifact tabs, stable breadcrumbs, published links, live updates, old revisions, clickable cards, rename, delete, translated controls, and reading a snapshot after its source file is removed.
