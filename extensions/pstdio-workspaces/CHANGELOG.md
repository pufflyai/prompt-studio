# pstdio-workspaces

## 0.2.1

_2026-11-14_

### Patch Changes

- de66f90: Hide session workspace information when Workspaces is unavailable and refresh open conversations when tools change.
- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

- f28e72e: Keep file trees current, show Git-ignored entries subdued, create entries from the background menu, and use the host's native file deletion confirmation.

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
