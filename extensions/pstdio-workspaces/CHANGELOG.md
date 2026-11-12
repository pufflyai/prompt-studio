# pstdio-workspaces

## 0.2.0

_2026-11-12_

### Minor Changes

- ee368ab: Browse project Files and workspaces from the bundled Workspaces extension. Group workspaces and their sessions by device, inspect capacity and change this device's limit, and retain scoped native file editing and lazy Git comparisons.

### Patch Changes

- fd5af30: Pin React and React DOM to exactly 19.2.4 in extension manifests and lockfiles.
- ea8ca3f: Clarify command palette names and groups, fill missing icons, and show assigned shortcut sequences.

  Raise the compiled core binary limit to 280 MB.

- 91b6eed: Install Sessions and Workspaces once per host user so they are available across that user's projects.
- 09fe379: Keep the selected workspace file when cancelling an action before its form finishes loading.
- 0389b3f: Complete workspace deletion through its Core owner without reporting a false extension ownership error.
- b3ad06a: Simplify the workspace list and device controls, and add creation to the Workspaces menu.
- e8a3b04: Make Compact ungrouped, open workspace creation and device details in modals, distinguish Files navigation, and use an optional workspace limit without unlimited usage counts.
- 11cd94a: Move device actions to context menus, use compact workspace dialogs with standard form actions, and remove Changes comparison controls.
