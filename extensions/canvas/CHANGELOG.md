# canvas

## 0.1.0-nightly.20261107111918

_2026-11-07_

### Minor Changes

- 3d76d3a: UI Canvas shows the project's own canvases from the build that `pstdio-canvas watch` writes, reloads only the frames whose code changed, and no longer ships a prebuilt catalog; canvas code always imports the `@pstdio/canvas` that runs the build; `@pstdio/canvas` no longer exports `./indexer`.
- 1e3a060: Review motion studies and shader versions in UI Canvas, with parameters and explicit version saving in a right-hand editor and the selected animation’s timeline and transport in a bottom tray.

  Show the selected animated frame’s timeline and transport in a contextual bottom tray, using the shared UI keyframe timeline. Keep parameter and version editing in the right menu.

- 547e56b: Keep Canvas and Lab state in ordered record fields, migrate retained shared content, and document explicit collaborative text and paged logs.

### Patch Changes

- a24082b: Describe how to propose a ticket's design in a `proposals/` folder built from copies of the real components.
- b2fec01: Add Cloud status and settings designs to UI Canvas.
- 93d1e74: Declare extension IDs and official harness SVG logos with Gallery Thumbnails for UI Canvas, optional Agent Reports, Themes, and unlisted Remote Workspaces.
- afd5581: Organize the Canvas catalog by purpose and consolidate navigable examples into fewer frames; make in-frame navigation the default for Canvas authoring.
- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.
- 1e3a060: Remove the retired Motion Lab and Shader Lab extensions and their legacy import bridges. UI Canvas owns motion reviews, shader versions, and comparison choices.
- 2e313d0: Use the gallery-thumbnails icon for canvas resources and open UI Canvas on the last visited design, falling back to the first available canvas or setup guidance.

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
