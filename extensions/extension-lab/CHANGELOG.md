# extension-lab

## 0.1.1

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.7.0`, `@pstdio/ui@0.7.1`

## 0.1.0

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

### Patch Changes

- 3e89b24: Add installed extension source reload, sync, and managed webview build watching.
- Updated dependencies [3e89b24]
- Updated dependencies [3e89b24]
  - @pstdio/sdk@0.4.2
