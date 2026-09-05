# Extension Lab

Sandbox extension that exercises the `defineExtension` API end-to-end while depending only on host-owned concepts. Use it as a reference when building an extension and as a smoke test for the runtime, CLI, dashboard, and harness registry.

See the [Extension API](../../.pstdio/docs/extensions/api.md) and [runtime architecture](../../.pstdio/docs/architecture/extensions-runtime.md) for the current contracts.

`id`: `pstdio.extension-lab`
`CLI namespace`: `extension-lab`

## Install

The lab lives in this repo, so you can install it as a local source instead of going through the catalog.

```bash
pst extensions add ./extensions/extension-lab
```

`pst extensions add` copies the source into `~/.pstdio/extensions/extension-lab` (override with `PSTDIO_HOME`), registers it as a local source, and enables it for the current project if you are inside one.

Verify and inspect:

```bash
pst extensions check
pst extension-lab --help
```

For local development, watch the repository source:

```bash
pst extensions dev ./extensions/extension-lab
```

## What it contributes

Everything below uses only host-owned workbench targets and lab-internal commands/events.

### Commands

| Local id          | Full id               | CLI? | Behavior                                                                                  |
| ----------------- | --------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `say-hello`       | `lab.say-hello`       | yes  | Toasts the active project label. Wired into the Lab route header.                         |
| `counter.bump`    | `lab.counter.bump`    | yes  | Increments a counter held in extension storage. Wired into the Lab route overflow menu.   |
| `counter.read`    | `lab.counter.read`    | yes  | Reads the counter from extension storage.                                                  |
| `counter.reset`   | `lab.counter.reset`   | yes  | Resets the counter. Wired into the Lab route overflow menu.                               |
| `glass-lab-artifacts.create` | `lab.glass-lab-artifacts.create` | no | Creates a randomized artifact in project-scoped extension storage.                       |
| `glass-lab-artifacts.delete` | `lab.glass-lab-artifacts.delete` | no | Deletes the selected artifact from extension storage.                                    |
| `glass-lab-artifacts.query` | `lab.glass-lab-artifacts.query` | no | Returns stored Glass Lab artifact rows for the data table renderer.                        |
| `parameters.query/update/apply` | `lab.parameters.*` | no | Loads and persists Parameter Lab controls; applying them creates an artifact.              |
| `review-checklist.query/update` | `lab.review-checklist.*` | no | Loads and persists the Review Lab checklist.                                               |
| `awaken`          | `lab.awaken`          | no   | Internal target. Toasts on success; the middleware rejects sentient titles.               |
| `demo.try-awaken` | `lab.demo.try-awaken` | yes  | Calls `lab.awaken` with title `"Gain consciousness"` to provoke the middleware.           |
| `heartbeat`       | `lab.heartbeat`       | no   | Invoked by the schedule below.                                                           |

### Middleware

- `rejectSentientAwakening` attaches to `lab.awaken`. Any title containing `consciousness` is rejected with code `sentience_rejected`. Demonstrates that pre-flight blocking belongs in middleware, not hooks (see proposal §7).

### Hooks

- The lab does not register a rejection notification hook; the demo command surfaces middleware rejections with a warning toast.

### Schedules

- `heartbeat` runs `lab.heartbeat` every minute (`* * * * *`).

### Harnesses

- `fake` registers the deterministic `pstdio.extension-lab.harness.fake` harness used by automated tests and manual smoke checks. It echoes canned messages, supports follow-up resume, and emits a question tool part when the prompt contains `__fake_question_prompt__`.

### Modes, views, placements, and navigation

- `modes.lab` is the Lab mode used by the Lab mode page. It supports Main and Side Panel content.
- `activityItems` adds the create-artifact action while Lab mode is active.
- `views` define each webview or native body once. The status view shows the artifact count and selected camera.
- `pages` define the Project Lab page, the Lab mode page, and the deliberately faulty page. Each navigation entry targets one page explicitly.
- `placements` put Artifacts, Cams, and Workflow in Main for Lab mode. The Lab mode page supplies Overview as its primary slot.
- `viewMenus` reuse the controls view for `Create artifacts` and the tree view for `Cameras`.
- The Lab mode page binds the artifact detail view to its auxiliary Side Panel slot.
- `statusBarItems` places the status view in the leading status-bar slot without adding it to persisted layout.
- `navigationTrees` adds the camera tree only while the Project Lab page is active.
- Switching pages exercises page cleanup, additive mode composition, and canonical page navigation.

### Storage

- Counter and Glass Lab artifact state live in extension storage, scoped to the current project.

### Native views, templates, and skills

- The Artifacts data-table view contributes a `glass-lab-artifact` table with row deletion and a Side Panel inspector.
- The artifact-create controls view backs the `Create artifacts` menu on the Artifacts view.
- The camera tree view lists the surveillance cameras in the Cams menu. Selecting one drives the procedural canvas video player.
- `templates.lab-resource` (type `glass-lab-artifact`) and `skills.lab-resource` exercise `packageAsset` resolution with Glass Lab assets.

> Color themes and file icon themes now ship in the `pstdio-base-themes` extension; the lab no longer contributes appearance assets.

## Trying it from the CLI

Once the lab is enabled for the current project, `extension-lab` becomes a CLI subcommand group:

```bash
pst extension-lab --help
pst extension-lab say-hello
pst extension-lab counter bump [--amount <number>]
pst extension-lab counter read
pst extension-lab counter reset
```

Provoke the rejection round trip end-to-end:

```bash
pst extension-lab demo try-awaken
```

Expected output: a `rejected` outcome with `code: "sentience_rejected"` and a warning notification toast in dashboard/testbench surfaces. The `heartbeat` schedule runs in the background — no CLI invocation needed; you should see a heartbeat log every minute while a project that has the lab enabled is loaded.

## Trying it from the dashboard

- The workbench top actions show **Lab: Say hello** on the lab route and **Bump lab counter / Reset lab counter / Demo middleware rejection** in the overflow.
- The project Sidenav shows separate Lab, Lab mode, and Lab faulty pages. Opening any entry replaces the active page through the same public page path used by other extensions.

## Layout

```
extensions/extension-lab/
  extension.ts         defineExtension manifest
  package.json         lab dependencies
  src/
    commands/          extension command definitions and schedules
    components/        React components used by the entries
    data/              settings, command clients, and shared state
    harnesses/         deterministic fake harness
    hooks/             extension hooks and React host hooks
    middlewares/       command middleware definitions
    renderers/         workbench contributions and webview shell
    utils/             shared helpers
    views/             webview entries and React view components
  skills/lab-resource/ Glass Lab artifact skill asset bundled via packageAsset
  templates/           template asset bundled via packageAsset
```
# Public page examples

The complete modules in [src/examples](src/examples) use only `@pstdio/sdk/extensions`.
Extension Lab installs them alongside its other contributions.

- [Scribble](src/examples/scribble.ts) saves documents and contributes a page-owned navigation tree.
- [Zipline](src/examples/zipline.ts) selects board rows and opens a resource inspector.
- [Pigeon](src/examples/pigeon.ts) selects table rows and opens a read-only message reader.
- [Commands](src/examples/commands.ts) declares a CLI command and resource header action.

Run `bun run --cwd extensions/extension-lab typecheck` to check the authoring code.
The normalizer tests load each module independently, and `public-page-patterns.spec.ts` exercises
them through the dashboard. The richer Workbench showcases demonstrate host customization.
