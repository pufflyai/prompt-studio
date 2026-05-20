# pstdio-dashboard-workbench

`pstdio-dashboard-workbench` is the **workbench-first** dashboard package for Prompt Studio.

It is **not** an in-place migration of `pstdio-dashboard`. It is a parallel package that
rebuilds the dashboard on top of [`pstdio-workbench`](../pstdio-workbench): a real
`WorkbenchCore` owns the registries and controllers, and the React `Workbench` shell renders
every dashboard surface from registered contributions instead of hard-coded route panels.

`pstdio-dashboard` remains the shipping dashboard. This package proves the workbench-first
architecture for PS-294 Phase 5.

## Architecture

| Concern | Workbench concept used |
| --- | --- |
| App shell | `createWorkbenchCore()` + `<Workbench workbench={...} />` |
| Screens (tickets, workspaces, sessions, settings, extensions) | Workbench **modules** registering **widgets** + **renderers** |
| Navigation tree | A **tree renderer** in the `left` area |
| Deep links (`/projects/:id/tickets/...`, legacy `?panel=` / `?tab=`) | A **navigation parser** that emits typed **navigation targets** |
| View state (panels / tabs) | **Layout** widget placements + **resource** opening — no `?panel=` / `?tab=` query state |
| Session chat across attached/bubble | A **keep-alive renderer** in the `floating` session panel |
| Per-project layout | `layout.setPersistenceScope("project:${projectId}")` + scoped panel persistence |
| Commands & shortcuts | `commands` + `keybindings` registries |

Data is live: surfaces read the synced `@tanstack/react-db` collections wired through
`src/sync`, the same boundary the existing dashboard uses.

### Project structure

- **`modules/`** — one folder per dashboard surface, independent from one another, each
  owning its workbench module registration.
- **`services/`** — shared code: the workbench composition (`create-dashboard-workbench`,
  ids, resources, navigation, persistence, module helpers) and shared components.
- **`lib/`** — API client and global external services (`@pstdio/sdk` sync, theme data).

A module folder contains:

- **`renderers/`** — stateful React components placed by the module's widgets.
- **`hooks/`** — data loading for that module (`@tanstack/react-db` live queries over the
  synced collections in `lib/sync`).
- **`components/`** — dumb presentational components, when extracted.

```
src/
  main.tsx                         app entry — providers + <DashboardApp />
  app.tsx                          resolves the active project, mounts the workbench
  lib/
    api.ts                         API client + base-url resolution
    sync/                          @pstdio/sdk sync collections + provider
    theme-preferences.ts           theme options
  services/
    components/                    shared presentational components
    workbench/
      create-dashboard-workbench.ts  createDashboardWorkbench(projectId)
      ids.ts                         shared widget / command ids
      module-helpers.ts              shared resource-opener helper
      resources/                     resource kinds + URI helpers
      navigation/                    deep-link -> navigation-target parser
      persistence/                   project-scoped layout + panel persistence
  modules/
    <surface>/<surface>-module.tsx   workbench module registration
    <surface>/renderers/             widget renderers
    <surface>/hooks/                 live-query data hooks
```

## Local scripts

| Script | Purpose |
| --- | --- |
| `bun run --cwd packages/pstdio-dashboard-workbench dev` | Vite dev server. Proxies `/v1` + `/healthz` to `PSTDIO_API_URL` (default `http://localhost:19841`). |
| `bun run --cwd packages/pstdio-dashboard-workbench build` | Type-check + production build. |
| `bun run --cwd packages/pstdio-dashboard-workbench typecheck` | `tsc -b`. |
| `bun run --cwd packages/pstdio-dashboard-workbench lint` | Type-check + Biome. |
| `bun run --cwd packages/pstdio-dashboard-workbench test` | Unit tests (navigation, resources, persistence, workbench wiring). |
| `bun run --cwd packages/pstdio-dashboard-workbench storybook` | Storybook on port 6008. |

The dev server needs a running pstdio API for live data. Start the isolated stack with
`bun run dev:isolated` and point the dev server at its API:

```sh
PSTDIO_API_URL=http://127.0.0.1:<api-port> bun run --cwd packages/pstdio-dashboard-workbench dev
```
