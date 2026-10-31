# pstdio-notes

## 0.46.0-nightly.20261031193213

_2026-10-31_

### Minor Changes

- 2ff78f4: Add shared keyboard actions and contextual targets across core extensions and repository tools, with G R for Scribble navigation.
- 2ff78f4: Add one default shortcut per resource creation and navigation action through existing UI flows.
- 4eeef83: Keep extension files in the full-ID `.pstdio/extension-storage/pstdio.<name>/` folder; earlier name-only folders are not read.

### Patch Changes

- b86f345: Add Home above Sessions, keep project navigation stable when entering and leaving tickets, place the mode return first in subnavigation content, and remove the desktop project breadcrumb button.
- 055ad0a: Offer New note in the Notes page menu and placeholder and make the Notes navigation root open its page.
- 4eeef83: Require extension API 0.2 or newer, because the chat link support uses resource-kind APIs that API 0.1.7 hosts do not have.
- 5e25e20: Accept extension API 0.3, which refuses storage records over 256 KiB and commits over 4 MiB.
- 16d0979: Use core record IDs in Planner, Reports, Notes and Artifacts and preserve stable migration imports.

## 0.45.0

_2026-10-22_

### Patch Changes

- d16f2d1: Open note paths from chat in the note editor, with the note title on the link.
- 94321b6: Declare Note and Artifact actions once for consistent resource menus.

## 0.44.0

_2026-10-18_

### Patch Changes

- d3a0941: Keep extension configuration, drafts, prototypes, tickets, reports, and backups in extension-storage.

## 0.43.1

_2026-10-13_

## 0.43.0

_2026-10-12_

### Minor Changes

- 50dc299: Add searchable nested Notes with uniquely named folders, immediate creation, first-save titles stored in Markdown front matter, persistent subtree dragging, tab actions, and deletion-safe refreshes, confirmed deletion and optimistic rename and removal, hide Workspaces by default, keep nested context menus beside their items, and reduce sidenav footer spacing.

## 0.42.0

_2026-10-10_

### Patch Changes

- c7713f3: Show assigned shortcuts under extension names, add main navigation and creation defaults with matching command palette hints, let idle navigation labels use the space released by hidden actions, and avoid unused schema snapshot extraction at startup.

## 0.41.0

_2026-10-08_

### Patch Changes

- f130437: Rewrite the extension READMEs and Planner docs for the new Docs tab on prompt.studio.

## 0.40.0

_2026-10-02_

## 0.39.0

_2026-09-30_

### Minor Changes

- 266e1fd: Declare the extension API as the caret range `^0.1.0` instead of a list of alpha versions.
- 5208194: Add Sidenav levels for pages, keep header rows and pinned rows visible inside levels, and give Notes and Sessions their own lists.

## 0.38.0

_2026-09-29_

## 0.37.0

_2026-09-29_

### Patch Changes

- 3985985: The Notes navigation entry shows only its title.
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
- ccbf130: Require the SDK release that provides conversation recovery and view data events.

## 0.35.0

_2026-09-26_

## 0.2.0

_2026-09-25_

### Minor Changes

- 1e6777b: Add repository-backed Markdown notes with independent titles, sidebar navigation, and a rename action.

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.25.0`
