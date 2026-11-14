# remote-workspaces

## 0.46.2-nightly.20261114030224

_2026-11-14_

### Patch Changes

- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

## 0.46.1

_2026-11-12_

### Patch Changes

- 93d1e74: Declare extension IDs and official harness SVG logos with Gallery Thumbnails for UI Canvas, optional Agent Reports, Themes, and unlisted Remote Workspaces.
- ea8ca3f: Clarify command palette names and groups, fill missing icons, and show assigned shortcut sequences.

  Raise the compiled core binary limit to 280 MB.

- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.

## 0.46.0

_2026-10-31_

### Minor Changes

- 4eeef83: Declare and verify supported extension API baselines for independently published core extensions.
- 2ff78f4: Add shared keyboard actions and contextual targets across core extensions and repository tools, with G R for Scribble navigation.

### Patch Changes

- 5e25e20: Accept extension API 0.3, which refuses storage records over 256 KiB and commits over 4 MiB.

## 0.45.0

_2026-10-22_

## 0.44.0

_2026-10-18_

### Patch Changes

- d3a0941: Keep extension configuration, drafts, prototypes, tickets, reports, and backups in extension-storage.

## 0.43.1

_2026-10-13_

## 0.43.0

_2026-10-12_

## 0.42.0

_2026-10-10_

## 0.41.0

_2026-10-08_

### Patch Changes

- f130437: Rewrite the extension READMEs and Planner docs for the new Docs tab on prompt.studio.
- 42d62b5: Delete unused ticket workspaces, mark tickets done on merge, and replace workspace archiving with deletion.

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

## 0.36.0

_2026-09-28_

### Patch Changes

- 42a6b1b: Declare conversation recovery and view dependencies for the next host API.
- 6efb4bf: Stop positional OpenCode message ids from moving a removed turn's attachments to another turn, and complete the host API alpha.12 migration.
- ccbf130: Require the SDK release that provides conversation recovery and view data events.

## 0.35.0

_2026-09-26_

## 2.0.2

_2026-09-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.25.0`

## 2.0.1

_2026-09-10_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.24.0`

## 2.0.0

_2026-09-09_

### Major Changes

- 54d1746: Move remote execution from examples into the remote-workspaces extension and connect workspace lifecycles and agent conversations to PocketCoder.

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.23.0`

## 1.1.0

_2026-09-07_

### Minor Changes

- 99d8075: Revise workbench composition, package delivery, navigation, typed controls, and placement lifecycle across the extension API.

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.22.0`

## 1.0.1

_2026-08-28_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.21.0`
