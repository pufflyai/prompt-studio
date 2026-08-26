# Prompt Studio Skills

## 0.3.4

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.3.3

_2026-08-24_

### Patch Changes

- b6ab04a: Use the new Prompt Studio slogan in product metadata and the built-in Prompt Studio skill.
- Updated internal dependencies: `@pstdio/sdk@0.19.0`

## 0.3.2

_2026-08-21_

### Patch Changes

- 8b7adf9: Teach the extension authoring skill the composition contracts: panels declare docked regions, resource kinds own slots, and modes place them through recipes
- e2b8668: rewrite documentation, skills, and templates in plain technical English
- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- b0457fc: Add explicit event-driven refresh contracts for native extension renderers.
- 86f01d9: Remove unwired extension renderer surfaces and legacy navigation metadata.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`

## 0.3.1

_2026-08-13_

### Patch Changes

- e66bcae: Validate extension dashboard capability compatibility during extension checks.
- 0ade6ec: Document the watch-based extension development workflow.
- 7bf5d83: Warn when extension panels use empty eligibleLocations and document panel role choices for extension authors.
- b4daee0: Add explicit, non-overwriting change request and review report workflows with no default report template.
- Updated internal dependencies: `@pstdio/sdk@0.17.0`

## 0.3.0

_2026-07-28_

### Minor Changes

- 43a57b9: Rename the data renderer API to kanban renderer and adopt the saved-view Kanban design.
- da4ea62: Rename Sidebar to Sidenav and add persistent Sidenav visibility and ordering
- b4b601b: Unify Workbench panel authoring, presentation, navigation, and persistence APIs

### Patch Changes

- f0c6bbf: Fix OpenCode skill status guidance and interactive question responses
- 73bc10c: Preserve mode-owned layouts while switching panels without resetting project chrome.
- 2cd0050: Extract planner automation into a repository extension and derive work activity from live sessions.
- 8d7d899: Rename the default "Ready" board status to "TODO" and color it purple
- 9c5337a: formalize extension roles and persist project-scoped workbench navigation
- 1014f2f: Carry recovery and validation steps in shipped messages and skills instead of pointing at repository-only files
- Updated internal dependencies: `@pstdio/sdk@0.16.0`

## 0.2.5

_2026-07-09_

### Patch Changes

- ab0193c: Rename bundled core extensions to Prompt Studio labels and stabilize provision hooks.
- ab0193c: Clarify extension install validation so global smoke tests install dependencies instead of using `--skip-install`.
- Updated internal dependencies: `@pstdio/sdk@0.15.0`

## 0.2.4

_2026-06-28_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.14.0`

## 0.2.3

_2026-06-16_

### Patch Changes

- 2cbc762: Rewrite the planner ticket skills around the real model: tickets are planner extension resources driven by `pst tickets …` (the same commands as the dashboard board and command palette), not a "legacy CLI". Drops the false legacy/planner-resource dichotomy, makes the CLI the primary path with the `write`/`pull` → edit → `save` draft loop, aligns the skills with the ticket templates (priority/type are tags, acceptance lives in the template), corrects the stale flags in the pstdio CLI reference, and aligns the lab skill's folder/name identity.
- 2cbc762: Fix skill SKILL.md frontmatter so `metadata` is a map; the previous sequence form was rejected by the Codex and Claude Code skill loaders.
- Updated internal dependencies: `@pstdio/sdk@0.13.1`

## 0.2.2

_2026-06-14_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.13.0`

## 0.2.1

_2026-06-11_

### Patch Changes

- fcc68a9: Clarify extension authoring guidance for data-renderer sidebar entries.
- fcc68a9: Move planner-owned translations into the planner extension and capitalize Harness terminology.
- bb253f4: Document the harness contribution point (lifecycle contract, namespaced ids, reattach) in the create-pstdio-extension reference.
- Updated internal dependencies: `@pstdio/sdk@0.12.0`

## 0.2.0

_2026-06-09_

### Minor Changes

- 6de1f50: Split shared pstdio skills into a dedicated default extension.

### Patch Changes

- 6f35233: Update bundled skills and prompts for pst command usage and extension ticket workflows.
- Updated internal dependencies: `@pstdio/sdk@0.11.0`

## 0.1.0

_2026-06-07_

Initial release.
