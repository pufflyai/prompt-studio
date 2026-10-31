# pstdio-artifacts

## 0.46.0-nightly.20261031193213

_2026-10-31_

### Minor Changes

- e30c373: Keep the Artifacts library and resource viewers in independent panel placements.
- 2ff78f4: Add shared keyboard actions and contextual targets across core extensions and repository tools, with G R for Scribble navigation.
- 2ff78f4: Add one default shortcut per resource creation and navigation action through existing UI flows.
- 4eeef83: Keep extension files in the full-ID `.pstdio/extension-storage/pstdio.<name>/` folder; earlier name-only folders are not read.

### Patch Changes

- 8e004ed: Theme Artifacts canvases from their own preview so `@pstdio/canvas` builds render them.
- b5d3e2c: Replace Storybook preview tooling with native Canvas composition and critical Playwright checks; limit visual verification guidance to critical risks; distribute UI Canvas as an optional extension with a working-with-Canvas skill and dependency-scoped frame startup.
- 4eeef83: Require extension API 0.2 or newer, because the chat link support uses resource-kind APIs that API 0.1.7 hosts do not have.
- 5e25e20: Accept extension API 0.3, which refuses storage records over 256 KiB and commits over 4 MiB.
- e30c373: Keep one artifact list tab, offer it in Main while closed, and let users move it between panels.
- 16d0979: Use core record IDs in Planner, Reports, Notes and Artifacts and preserve stable migration imports.

## 0.45.0

_2026-10-22_

### Patch Changes

- d16f2d1: Open artifact snapshot paths from chat in the artifact viewer, with the artifact name on the link.
- 94321b6: Declare Note and Artifact actions once for consistent resource menus.
- 94321b6: Resolve missing and deleted artifacts without reporting command errors.

## 0.44.0

_2026-10-18_

### Patch Changes

- d3a0941: Keep extension configuration, drafts, prototypes, tickets, reports, and backups in extension-storage.
- 191998c: Link the publish-artifact skill to the public Artifacts and extension storage docs.

## 0.43.1

_2026-10-13_

## 0.43.0

_2026-10-12_

### Patch Changes

- f099340: Simplify the artifact library with separated project brief and system diagram buttons, make library breadcrumbs clickable, move resource actions into the breadcrumb header, add version icons, and register searchable artifact resources.

## 0.42.0

_2026-10-10_

### Patch Changes

- c7713f3: Show assigned shortcuts under extension names, add main navigation and creation defaults with matching command palette hints, let idle navigation labels use the space released by hidden actions, and avoid unused schema snapshot extraction at startup.
- 58be8c3: Keep the Artifacts extension private so releases do not attempt to publish it to npm.

## 0.41.0

_2026-10-08_

### Patch Changes

- f130437: Rewrite the extension READMEs and Planner docs for the new Docs tab on prompt.studio.
- 242bc5c: Add configurable UX refinement prototypes and publish optional Artifacts with header search.

## 0.40.0

_2026-10-02_

## 0.39.0

_2026-09-30_

### Minor Changes

- 266e1fd: Declare the extension API as the caret range `^0.1.0` instead of a list of alpha versions.

## 0.38.0

_2026-09-29_

## 0.37.0

_2026-09-29_

### Patch Changes

- 9ef96aa: Declare compatibility with explicit navigation and resource removal on extension API alpha.14.

## 0.36.1

_2026-09-28_

### Patch Changes

- a4f8c23: Ship a lockfile so installs download only runtime dependencies.

## 0.36.0

_2026-09-28_

### Patch Changes

- 42a6b1b: Declare conversation recovery and view dependencies for the next host API.
- 8a924d0: Use workspace APIs for project files, notes, reports, and ticket workflows.
- 6efb4bf: Stop positional OpenCode message ids from moving a removed turn's attachments to another turn, and complete the host API alpha.12 migration.

## 0.35.0

_2026-09-26_

## 0.2.4

_2026-09-25_

### Patch Changes

- fbb0c3e: Adopt explicit handler navigation and resource removal reporting in first-party extensions.
- Updated internal dependencies: `@pstdio/ui@0.26.0`, `@pstdio/sdk@0.25.0`

## 0.2.3

_2026-09-14_

### Patch Changes

- a4fa9de: Align extension Bun type definitions to 1.4.2.
- Updated internal dependencies: `@pstdio/sdk@0.24.1`, `@pstdio/ui@0.25.0`

## 0.2.2

_2026-09-10_

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.24.2`, `@pstdio/sdk@0.24.0`

## 0.2.1

_2026-09-09_

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.24.1`

## 0.2.0

_2026-09-09_

### Minor Changes

- 73ded1d: Add a theme-aware artifact gallery with persistent tabs, agent publishing, version history, rename, and delete.

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.24.0`, `@pstdio/sdk@0.23.0`
