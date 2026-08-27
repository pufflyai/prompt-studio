# extension-lab

## 0.8.3

_2026-08-27_

### Patch Changes

- 004b96c: Preserve extension command responses, register extension shortcuts, and restore artifact workflow behavior.
- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- 40e4fd6: Add provider-backed workspace creation.
- d7a5b16: Add generic resource menus, dashboard anchors, and contribution diagnostics.
- d63d57d: Remove the host workspace mode and target workspace actions with workbenchResourceKinds.workspace.
- 545d925: Pass command and middleware parameters as the second handler argument across the extension API.
- 545d925: Add stable workbench views and migrate extension navigation.
- 82138c3: Update the Bun toolchain requirement to 1.3.14.
- Updated internal dependencies: `@pstdio/sdk@0.21.0`, `@pstdio/ui@0.21.0`

## 0.8.2

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.8.1

_2026-08-24_

### Patch Changes

- c257623: Remove the Planner ticket resource dependency.
- Updated internal dependencies: `@pstdio/ui@0.20.1`, `@pstdio/sdk@0.19.0`

## 0.8.0

_2026-08-21_

### Minor Changes

- b0457fc: Add explicit event-driven refresh contracts for native extension renderers.
- fcd283d: Let panels place every native renderer through one renderer reference.

### Patch Changes

- 8b7adf9: Add composition conformance fixtures: two Lab modes over one shared resource, a cross-extension inspector in the Planner ticket slot, and the tests that lock both in
- 883e31b: Add explicit row activation callbacks for data table and Kanban renderers.
- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- 8b7adf9: Declare Planner and Extension Lab composition with resource kinds, slots, and mode recipes, and move the Lab status bar to a typed status item
- 7cb9939: Replace renderer-owned command bindings with private callbacks.
- 4dc237f: Share renderer invocation context contracts across first-party renderers.
- 7c538c9: Unify extension navigation targets and placement strategies.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`, `@pstdio/ui@0.20.0`

## 0.7.2

_2026-08-13_

### Patch Changes

- 78e3af9: Rework the Extension Lab into a single Lab mode: native activity items with a project-home shortcut, a status strip, panel menus for creating artifacts and picking cameras, and a Side Panel artifact inspector.
- 78e3af9: Improve Extension Lab modes and Glass Lab artifact workflows
- 78e3af9: Keep first-party extension UI dependencies aligned with the host UI package
- Updated internal dependencies: `@pstdio/sdk@0.17.0`, `@pstdio/ui@0.19.0`

## 0.7.1

_2026-08-04_

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.18.0`

## 0.7.0

_2026-07-28_

### Minor Changes

- 43a57b9: Rename the data renderer API to kanban renderer and adopt the saved-view Kanban design.
- da4ea62: Rename Sidebar to Sidenav and add persistent Sidenav visibility and ordering
- b4b601b: Unify Workbench panel authoring, presentation, navigation, and persistence APIs

### Patch Changes

- 39de767: Restore ticket interactions and settings, add renderer-owned create forms, and refresh local extension modes.
- 73bc10c: Preserve mode-owned layouts while switching panels without resetting project chrome.
- 9c5337a: formalize extension roles and persist project-scoped workbench navigation
- Updated internal dependencies: `@pstdio/ui@0.17.0`, `@pstdio/sdk@0.16.0`

## 0.6.0

_2026-07-09_

### Minor Changes

- 9b18789: Add host-owned workbench terminal tabs with workspace-scoped PTY sessions, workspace-only terminal chrome, faster terminal first paint, and Extension Lab cleanup that opens host terminals instead of rendering its own xterm route.

### Patch Changes

- 51d5a3f: Merge the deterministic fake harness into extension lab.
- bdfaf8d: Remove notices screen and tighten foundation UI styling
- Updated internal dependencies: `@pstdio/ui@0.16.0`, `@pstdio/sdk@0.15.0`

## 0.5.0

_2026-06-28_

### Minor Changes

- aec472d: Add durable notification center and inbox workflows.

### Patch Changes

- aec472d: Allow repeated lab inbox demo notifications and keep their action command wired.
- 21d7d58: Remove shadow styling in favor of border highlights
- Updated internal dependencies: `@pstdio/ui@0.15.0`, `@pstdio/sdk@0.14.0`

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
