# Xvfb needs a window manager for native window state

## Symptom

Electron launches under Linux Xvfb, but `BrowserWindow.minimize()` leaves it visible and `isMinimized()` stays false. Waiting longer does not establish the expected native state.

## Cause

Xvfb provides an X server. Native minimize and restore requests also need a window manager. Source Electron CI previously supplied only Xvfb.

## Rule

The source Electron Playwright configuration owns this prerequisite in `clients/desktop/src/testing/source-electron-setup.ts`. Normal Linux desktops reuse their validated existing window manager. On bare Xvfb, the harness starts and owns Openbox; local runs need Openbox and x11-utils installed. GitHub Actions provisions missing tools during environment setup. The harness inherits the same display, validates root and owner `_NET_SUPPORTING_WM_CHECK` properties, and returns an awaited disposer for its own manager. Unexpected owned-manager death fails teardown. Keep native assertions and existing time limits. Browser-only tests and packaged performance baselines retain their existing setup.

Release verification keeps trusted workflow definitions on main while checking out an exact candidate. Put candidate-specific native test prerequisites in the source test harness, so existing trusted workflow calls also execute them. Playwright retains ownership of test workers and runtime processes; an additional command wrapper can complicate cancellation across nested process groups.

## Evidence

PS-202, PR #1987: Linux job130320431880 launched Electron successfully, then exhausted the existing5s minimize predicate with `visible: true` and `minimized: false`. Its workflow used bare Xvfb. RP-664 retains the first-failure log and subsequent validation.
