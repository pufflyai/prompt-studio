# @pstdio/desktop

## 0.46.0

_2026-10-31_

### Minor Changes

- 9931aa2: Breaking: 0.46 starts with a new database; data from older releases is exported as JSON to `~/.pstdio/backups/pre-0.46-*` for agents to re-import, and `ctx.storage.readLegacy` now always returns undefined.

### Patch Changes

- 422d8cb: Keep panel and fullscreen controls visible beside native window buttons on Linux and Windows.
- 64513fa: Record native performance collection on time and reduce desktop checksum allocation work.
- 22f6142: Update Electron to 43.8.1 to fix all open desktop security alerts.
- f5c5c4b: Keep desktop recovery actions visible while long startup diagnostics scroll.

## 0.45.0

_2026-10-22_

### Patch Changes

- 501fd58: Update Electron to 43.7.0 so HID and USB permission checks use the right origin.
- 6ab9670: Update Vite to fix the desktop development server security alerts.

## 0.44.0

_2026-10-18_

### Patch Changes

- d4a9bbc: Move Settings into the macOS Prompt Studio menu with its Command+Comma shortcut.
- eb26d78: Show correct database ownership recovery and allow Retry as soon as recovery is visible. Wait for the first workbench load before showing quit confirmation, and update shared resource inspectors during navigation.
- 1ec80dd: Keep startup waiting with progress and a 20-second notice, wait for cleanup on Quit, and hide project search below eight projects.

## 0.43.1

_2026-10-13_

### Patch Changes

- 94ce006: Explain the macOS password prompt before installing the pst command, offer Not Now, and let agents in Prompt Studio run pst even when the command is not installed in Terminal.

## 0.43.0

_2026-10-12_

### Minor Changes

- 2c97ba5: Add a nightly update channel: choose Stable or Nightly in Settings → Developer tools or with `pst update-channel`, and the desktop app now checks for updates on launch and every four hours.

## 0.42.0

_2026-10-10_

## 0.41.0

_2026-10-08_

### Minor Changes

- 576eb55: The desktop app remembers your theme between launches, opens its startup, recovery, and closing screens in that theme, and shows the warning about running work as a dialog over the workbench.
- 2bf353b: Add opt-in performance monitoring under Settings → Developer tools. A frame-rate meter in the status bar opens a popover with the frame rate, the CPU of the workbench and of extension processes, and Pause for an extension that slows the app down. Agents read the same snapshot with `pst performance`.

### Patch Changes

- b2f4cfb: Give the macOS DMG window a Prompt Studio background with the app and Applications icons on each side of a drag arrow.
- 54f25c0: Keep the browser session out of cookies, so other servers on `127.0.0.1` never receive it and two runtimes in one browser keep separate sessions.
- b94e9f1: Browsers sign in to the local runtime through a single-use link that `pst` opens, and a page load no longer hands out the runtime token.
- b94e9f1: The desktop app quits after its runtime crashes instead of reporting that the runtime refused to shut down.

## 0.40.0

_2026-10-02_

### Patch Changes

- a35bf53: Keep each project's layout, including the Side Panel, across project switches, reloads, and desktop restarts.

## 0.39.0

_2026-09-30_

## 0.38.0

_2026-09-29_

## 0.37.0

_2026-09-29_

### Minor Changes

- d0b80f6: Add declared clipboard writes and a shared CopyButton for extension drafts.
- b5d8767: Make the bundled pst command available from macOS, Windows, and Linux desktop installations.

## 0.36.1

_2026-09-28_

## 0.36.0

_2026-09-28_

## 0.35.0

_2026-09-26_

## 0.34.0

_2026-09-25_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.34.0`.

## 0.33.3

_2026-09-15_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.33.3`.

## 0.33.2

_2026-09-14_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.33.2`.

## 0.33.1

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.33.1`.

## 0.33.0

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.33.0`.

## 0.32.2

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.32.2`.

## 0.32.1

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.32.1`.

## 0.32.0

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.32.0`.

## 0.31.0

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.31.0`.

## 0.30.0

_2026-09-13_

### Patch Changes

- Synchronize the desktop application with `pstdio@0.30.0`.
