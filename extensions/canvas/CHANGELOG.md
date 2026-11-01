# canvas

## 0.1.0-nightly.20261101230131

_2026-11-01_

### Minor Changes

- 3d76d3a: UI Canvas shows the project's own canvases from the build that `pstdio-canvas watch` writes, reloads only the frames whose code changed, and no longer ships a prebuilt catalog; canvas code always imports the `@pstdio/canvas` that runs the build; `@pstdio/canvas` no longer exports `./indexer`.

### Patch Changes

- a24082b: Describe how to propose a ticket's design in a `proposals/` folder built from copies of the real components.

## 0.0.1

_2026-10-31_

### Patch Changes

- 2f9afd0: Keep themes steady across projects, share theme conversion, and add Prompt Contrast Light and Dark.
- 8e004ed: Read UI Canvas's design pages from `@pstdio/ui` and let canvas files theme their frames from their `.canvas/preview.tsx` decorators.
- 2523fc7: Refresh native previews for project-scoped storage refreshes.
- bb32c46: Keep Canvas freshness hashes in a local cache to avoid unrelated pull request conflicts.
- b5d3e2c: Replace Storybook preview tooling with native Canvas composition and critical Playwright checks; limit visual verification guidance to critical risks; distribute UI Canvas as an optional extension with a working-with-Canvas skill and dependency-scoped frame startup.
- 856afcf: Keep retained workbenches isolated while switching between projects.
- e9a3e6c: Build the preview catalog from source instead of keeping it in Git.
- 5d353fb: Keep preview imports within the Canvas startup concurrency limit.
- 1d15cbb: Load only each Canvas frame's compiled dependencies, cache immutable preview assets, and prioritize visible frame startup while preserving sandbox isolation and drafts.
- 790af40: Remove the last Storybook leftovers: MDX documentation pages, Storybook-only canvas fields and the migration ledger; frames now read plain `description` and `fullscreen` fields.
- a2926f3: Build Canvas preview archives and source fingerprints correctly on Windows.
