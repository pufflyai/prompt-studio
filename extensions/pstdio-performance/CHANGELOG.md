# pstdio-performance

## 0.2.1-nightly.20261128192510

_2026-11-28_

### Patch Changes

- 958363f: Keep extensions available on the next host API while retaining compatibility with previously supported hosts.
- 27e5ee4: Show pending status when copying performance data or pausing and resuming an extension. Reflect the selected React render highlight setting immediately.

## 0.2.0

_2026-11-21_

### Minor Changes

- b557d47: Add cancellable backend CPU profiles and function-call captures to Performance Monitoring, with matching CLI status and JSON export. Keep bounded evidence on the runtime machine and replace the temporary repository diagnostic extension.
- 52fbda2: Use canonical first-party package names and concise Notes commands on migration-capable API 0.5 hosts. Remove declared global CLI shortcuts and use publisher-qualified Planner and Reports commands.
- f94c3f2: Add React render highlighting in the Performance popover footer, use shared scrolling for the metrics, and keep backend diagnostic captures in the CLI.
- 324e652: Preserve shared project and document state while views switch or reopen, adopt retained read owners and scoped invalidation, and keep required saves and bounded recovery work with their domain owners.
- 226fbff: Record the next backend CPU spike with recent CPU profiles, database origins and timings, and chat encoding measurements in one bounded local export. Preserve completed recording windows if the backend is interrupted.

### Patch Changes

- b510245: Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

  Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

  Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.

- 7d834a4: Install the React query dependency required by Performance Monitoring so isolated installations can activate its views and complete project setup.
- a0fb3f5: Keep action errors local and dismissible, show system notices in the status bar, and represent workspace readiness in the conversation controls.

## 0.1.1

_2026-11-12_

### Patch Changes

- fd5af30: Pin React and React DOM to exactly 19.2.4 in extension manifests and lockfiles.
- 93d1e74: Declare extension IDs and official harness SVG logos with Gallery Thumbnails for UI Canvas, optional Agent Reports, Themes, and unlisted Remote Workspaces.
- ed40a9d: Keep maintained extensions loadable across the existing and upcoming ordered-storage API hosts.
- c3a5eb3: Prepare status details before the first click, preserve their state, and pause hidden views through shared presentation visibility.
- b2fec01: Use the shared icon and title popover header in Performance and Auto Build, without a redundant close button.

## 0.1.0

_2026-10-31_

### Minor Changes

- e3b8456: Add Prompt Studio Performance Monitoring: a status bar meter and details with frame rate, backend response time, CPU and memory history, and one pausable row per extension.

### Patch Changes

- 8e004ed: Theme Performance canvases from their own preview so `@pstdio/canvas` builds render them.
- 700a491: Keep resumed extensions visible while their next process measurement arrives.
