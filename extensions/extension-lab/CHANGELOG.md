# extension-lab

## 0.4.5

_2026-06-23_

### Patch Changes

- 36487b3: Use outline and primary button variants instead of solid buttons.
- Updated internal dependencies: `@pstdio/ui@0.14.0`, `@pstdio/sdk@0.13.2`

## 0.4.4

_2026-06-17_

### Patch Changes

- d8383a9: Extensions can contribute file icon themes that render in workbench file trees. New `pstdio-base-themes` extension ships Monokai, Solarized Light/Dark, Dracula, and the Seti file icon theme (the default for file trees); appearance themes/icons were removed from `extension-lab`. The theme picker now groups entries by light/dark.
- Updated internal dependencies: `@pstdio/ui@0.13.0`

## 0.4.3

_2026-06-16_

### Patch Changes

- 2cbc762: Rewrite the planner ticket skills around the real model: tickets are planner extension resources driven by `pst tickets …` (the same commands as the dashboard board and command palette), not a "legacy CLI". Drops the false legacy/planner-resource dichotomy, makes the CLI the primary path with the `write`/`pull` → edit → `save` draft loop, aligns the skills with the ticket templates (priority/type are tags, acceptance lives in the template), corrects the stale flags in the pstdio CLI reference, and aligns the lab skill's folder/name identity.
- 2cbc762: Fix skill SKILL.md frontmatter so `metadata` is a map; the previous sequence form was rejected by the Codex and Claude Code skill loaders.
- Updated internal dependencies: `@pstdio/ui@0.12.2`, `@pstdio/sdk@0.13.1`

## 0.4.2

_2026-06-14_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.13.0`, `@pstdio/ui@0.12.0`

## 0.4.1

_2026-06-11_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.12.0`, `@pstdio/ui@0.11.0`

## 0.4.0

_2026-06-09_

### Minor Changes

- 6e40115: Add an extension keybinding contribution API backed by TanStack Hotkeys, surfaced in extension checks, workbench metadata, and the extension testbench.
- ca7222b: Add the extension platform runtime with user and repo extension discovery, extension settings, workbench attachments, hot reload, packaged extension loading, and SDK workbench target APIs.

### Patch Changes

- 6de1f50: Add explicit extension command palette contributions
- 6de1f50: Add a Glass Lab artifact demo and testbench theme contribution browsing.
- e887758: Add extension translation tokens, bundles, locale-aware host rendering, and localized extension-lab samples.
- 6f35233: Add a command palette resource provider API: extensions contribute dynamic, searchable palette results via a queryCommand instead of static command entries.
- ca7222b: Polish command palette focus colors, sidebar tree reloads, diff loading states, resource icons, side-panel onboarding, shared control behavior, and extension lab layout styling.
- Updated internal dependencies: `@pstdio/sdk@0.11.0`, `@pstdio/ui@0.10.0`

## 0.3.0

_2026-06-01_

### Minor Changes

- f6ec9d8: Replace the legacy project-local automation system with an extension platform: user/repo extension discovery and load scopes, first-class extension settings, extension-provided mode layouts, host-owned workbench target attachments and header actions, hot reload, and SDK workbench/ticket APIs.
- f6ec9d8: Move the bundled Monokai theme into extension lab and map VS Code / extension theme tokens into workbench app tokens.

### Patch Changes

- f6ec9d8: Adopt @pstdio/sdk 0.9.0: use the renamed workbench targets (`workbench.top.*` → `workbench.nav.*`, `workbench.main.bottom` → `workbench.secondary`).
- Updated internal dependencies: `@pstdio/sdk@0.10.0`, `@pstdio/ui@0.9.0`

## 0.2.0

_2026-05-20_

### Minor Changes

- 57c9122: Add extension lifecycle events and worktree helpers for extension-owned worktree setup automation.

### Patch Changes

- 57c9122: Run extension schedules and replace the starter heartbeat plugin with lab heartbeat logging.
- Updated internal dependencies: `@pstdio/sdk@0.8.0`, `@pstdio/ui@0.8.0`

## 0.1.1

_2026-05-17_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.7.0`, `@pstdio/ui@0.7.1`

## 0.1.0

_2026-05-16_

### Minor Changes

- e3693cb: Add capability-gated bridge webviews for extension routes and workbench renderers.
- 4636558: Declare extension identity through the package manifest.

### Patch Changes

- Updated dependencies [8366f27]
- Updated dependencies [1465bb8]
- Updated dependencies [cb8b2d1]
- Updated dependencies [ebc2c7f]
- Updated dependencies [cb8b2d1]
- Updated dependencies [c256713]
- Updated dependencies [2fa3aa2]
- Updated dependencies [8366f27]
- Updated dependencies [8366f27]
- Updated dependencies [8366f27]
- Updated dependencies [48ba104]
- Updated dependencies [1cdb3c0]
- Updated dependencies [e3693cb]
- Updated dependencies [8d57ab1]
- Updated dependencies [8366f27]
- Updated dependencies [8366f27]
- Updated dependencies [8d57ab1]
- Updated dependencies [2fa3aa2]
- Updated dependencies [8366f27]
- Updated dependencies [4636558]
- Updated dependencies [1cdb3c0]
- Updated dependencies [7fe76bc]
- Updated dependencies [2f5fbad]
- Updated dependencies [e3693cb]
- Updated dependencies [4e73f2e]
- Updated dependencies [8366f27]
- Updated dependencies [709dfc6]
- Updated dependencies [cb8b2d1]
- Updated dependencies [b04d6cf]
  - @pstdio/ui@0.7.0
  - @pstdio/sdk@0.6.0

## 0.0.2

_2026-05-10_

### Patch Changes

- 3217943: Move the dashboard command palette to opt-in via a new `projectSlots.commandPanel` menu slot. Extensions now choose which commands to surface in the palette by listing them under `menus`, mirroring how header buttons already work. Drops the prior `commandPanel: boolean | object` field on `CommandDefinition`, the `CommandPanelContribution` interface, and the `excludeFromPalette` record field that was opt-out.
- 3217943: Harden extension webview runtime serving and iframe sandboxing.
- Updated dependencies [3217943]
- Updated dependencies [f934e4d]
- Updated dependencies [990b414]
- Updated dependencies [eb2f9f4]
- Updated dependencies [990b414]
- Updated dependencies [d65a8be]
- Updated dependencies [990b414]
- Updated dependencies [095fbd3]
- Updated dependencies [8adca2c]
  - @pstdio/sdk@0.5.0
  - @pstdio/ui@0.6.0

## 0.0.1

_2026-05-07_

### Patch Changes

- 3e89b24: Add installed extension source reload, sync, and managed webview build watching.
- Updated dependencies [3e89b24]
- Updated dependencies [3e89b24]
  - @pstdio/sdk@0.4.2
