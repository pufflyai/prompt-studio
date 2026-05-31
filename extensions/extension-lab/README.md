# Extension Lab

Sandbox extension that exercises the proposal-stage `defineExtension` API end-to-end while depending only on **kernel-owned** concepts (no `pstdio-ext-planner`, no `pstdio-ext-workspace-shell`). Use it as a reference when building a real extension and as a smoke test that the runtime, CLI, and dashboard wire the surfaces correctly.

> Status: this lab targets the proposed `@pstdio/sdk/extensions` API. The runtime that loads it is not shipped yet — see [`extensions/docs/extension-runtime.md`](../docs/extension-runtime.md) and [`extensions/docs/pstdio-extension-api.md`](../docs/pstdio-extension-api.md).

`id`: `pstdio.extension-lab`
`namespace`: `lab`

## Install

The lab lives in this repo, so you can install it as a local source instead of going through the catalog.

```bash
pstdio extensions add ./extensions/extension-lab
```

`pstdio extensions add` copies the source into `~/.pstdio/extensions/extension-lab` (override with `PSTDIO_HOME`), registers it as a local source, and enables it for the current project if you are inside one.

Verify and inspect:

```bash
pstdio extensions list
pstdio extensions check
pstdio lab --help
```

Edit in place and live-reload picks up changes:

```bash
code ~/.pstdio/extensions/extension-lab
```

Disable / remove for the current project (keeps the source on disk):

```bash
pstdio extensions disable extension-lab
pstdio extensions remove extension-lab
```

## What it contributes

Everything below uses only host-owned workbench targets and lab-internal commands/events.

### Commands

| Local id          | Full id               | CLI? | Behavior                                                                                  |
| ----------------- | --------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `say-hello`       | `lab.say-hello`       | yes  | Toasts the active project label. Wired into the Lab route header.                         |
| `counter.bump`    | `lab.counter.bump`    | yes  | Increments a counter held in extension storage. Wired into the Lab route overflow menu.   |
| `counter.reset`   | `lab.counter.reset`   | yes  | Resets the counter. Wired into the Lab route overflow menu.                               |
| `awaken`          | `lab.awaken`          | no   | Internal target. Toasts on success; the middleware rejects sentient titles.               |
| `demo.try-awaken` | `lab.demo.try-awaken` | yes  | Calls `lab.awaken` with title `"Gain consciousness"` to provoke the middleware.           |
| `heartbeat`       | `lab.heartbeat`       | no   | Invoked by the schedule below.                                                           |

### Middleware

- `rejectSentientAwakening` attaches to `lab.awaken`. Any title containing `consciousness` is rejected with code `sentience_rejected`. Demonstrates that pre-flight blocking belongs in middleware, not hooks (see proposal §7).

### Hooks

- `notifySentienceRejected` observes `commandEvent(lab.awaken, "rejected")` and toasts the reason. Hooks cannot affect the rejected command — they only react.

### Schedules

- `heartbeat` runs `lab.heartbeat` every minute (`* * * * *`).

### Modes, routes, views, and tree items

- `modes.lab` registers `pstdio.extension-lab.lab` with `layout.reset: true`.
- `modes.labFocus` registers `pstdio.extension-lab.focus` with a main-area-only reset.
- `views.labSidebar` and `views.labOverview` are opened by those mode layouts.
- `routes.labPage` registers a project-level page at path `lab`, rendered through a webview.
- `treeItems.openLabMode` switches to the lab mode through `workbench.action.switchMode`.
- `treeItems.labPage` adds a left-tree entry that targets the route, with the `flask-conical` icon.

### Storage

- Counter state lives in extension storage at key `counter`, scoped to the current project.

### Templates and skills

- `templates.labTicket` (type `ticket`) and `skills.lab` exercise `packageAsset` resolution from the installed extension source.

### Appearance

- `themes.monokai` and `themes.dracula` exercise VS Code color theme assets mapped into dashboard and editor themes.
- `fileIconThemes.seti` exercises a VS Code file icon theme asset with a packaged font.

## Trying it from the CLI

Once the lab is enabled for the current project, the namespace `lab` becomes a CLI subcommand group:

```bash
pstdio lab --help
pstdio lab say-hello
pstdio lab counter bump
pstdio lab counter reset
```

Provoke the rejection round trip end-to-end:

```bash
pstdio lab demo try-awaken
```

Expected output: a `rejected` outcome with `code: "sentience_rejected"`, plus a toast on any open dashboard. The hook then toasts a second time as it observes the `rejected` lifecycle event. The `heartbeat` schedule runs in the background — no CLI invocation needed; you should see a heartbeat log every minute while a project that has the lab enabled is loaded.

## Trying it from the dashboard

- The workbench top actions show **Lab: Say hello** on the lab route and **Bump lab counter / Reset lab counter / Demo middleware rejection** in the overflow.
- The project sidebar shows lab entries for the mode and route. The mode entry activates `pstdio.extension-lab.lab`; the route entry navigates to `lab`.

## Layout

```
extensions/extension-lab/
  extension.ts         defineExtension manifest
  package.json         lab dependencies and the webview build script
  src/
    views/             React view components
    *.tsx              webview entries
    components/        React components used by the entries
    store/             zustand store shared between views
  themes/              VS Code color theme assets
  icons/               VS Code file icon theme assets
  skills/lab-skill/    skill asset bundled via packageAsset
  templates/           template asset bundled via packageAsset
```
