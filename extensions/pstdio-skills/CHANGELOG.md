# pstdio Skills

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
