# @pstdio/desktop

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
