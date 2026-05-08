# Next steps — extension UI integration after main merge

The `main` merge brought in the new extension command runtime (PS-90/PS-111). The dashboard's contribution surfaces have now been re-wired against it; this file tracks what remains.

See [MANUAL_TEST.md](./MANUAL_TEST.md) for the reproduction script.

## What works today

- `pstdio extensions add <path>` registers a local source, copies it under `~/.pstdio/extensions/<name>`, and enables it for the current project (7 commands, 0 errors for `extension-lab`).
- `pstdio extensions check` reports the install state, including diagnostics from the contribution collector.
- `GET /v1/projects/:id/extensions/commands` returns commands + diagnostics with the runtime shape (`id`, `extensionId`, `namespace`, `title`, `description?`, `cliPath?`, `examples?`, `params?`).
- `GET /v1/projects/:id/extensions/ui` returns the full `DashboardExtensionMetadata` shape (`extensions`, `commands`, `menuContributions`, `views`, `routes`, `navigation`, `settingsPanels`, `diagnostics`) so the dashboard's contribution hosts (sidebar nav, header buttons, header overflow, route shell, settings panels, command palette grouping) all populate.
- `POST /v1/projects/:id/extensions/commands/:id/execute` runs a command end-to-end. `lab.say-hello` returns `{ outcome: { status: "success", value: { message: "hello dispatched" }, notices: [{ title: "Lab", message: "Hello from the lab — project <id>" }] } }`.
- The `lab.heartbeat` schedule fires once per minute (visible in `docker logs`).
- The CLI surface (`pstdio lab say-hello`, `pstdio lab counter bump`, etc.) executes against the same runtime and matches the API output.
- The command palette is now opt-in via the new `projectSlots.commandPanel` menu slot. Extensions list commands they want surfaced in the palette under `menus`, the same way header buttons already work. The dashboard's palette host reads `menuContributions` filtered to that slot and groups entries by extension `displayName`.
- The runtime-ui helpers (`resolveMenuContributionsForSlot`, `sortDiagnostics`, `groupDiagnosticsBySeverity`) and the webview bridge (`bridge/host`, `bridge/guest`, `bridge/contract`) live in `pstdio-extensions/src/{runtime-ui,bridge}` and are exposed via subpath exports.

## What is broken

### 1. The lab route's iframe content does not render

`/projects/:id/extensions/lab` mounts the route shell, but the iframe attempts to load `file:///root/.pstdio/extensions/extension-lab/src/main.tsx` and the browser refuses to load `file://` content over HTTP.

The data path is correct: the route record returned by `/extensions/ui` carries the original `packageAsset` descriptor (`{ kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///..." }`). The dashboard's [`ExtensionWebviewFrame`](../pstdio-dashboard/src/shared/extensions/components/extension-webview-frame.tsx) currently resolves `entry.path` against `entry.baseUrl` directly, which produces the unloadable `file://` URL.

The API already exposes `GET /extensions/installed/:installName/webviews/*` ([`extension-webview-assets.ts`](../pstdio-api/src/features/extensions/extension-webview-assets.ts)). The remaining work is to translate webview entries onto that route — most cleanly via the [`extension-webview-build-manager`](../pstdio-api/src/features/extensions/extension-webview-build-manager.ts) producing a `runtimeUrl` per webview that the dashboard then trusts. Once that is wired, swapping `ExtensionWebviewFrame` for `bridge/host`'s `ExtensionFrame` (which already speaks the `runtimeUrl` + `moduleUrl` contract) becomes a follow-up that also unlocks the `theme`, `props`, and `capabilities` round-trip.

### 2. Bun listening on `localhost` resolves to IPv6 in docker

`Bun.serve({ hostname: "localhost", … })` binds `::1` only inside the container, so any `bun fetch http://localhost:…` from the same container hits IPv4 and is refused. This made `pstdio projects create` fail at boot.

Mitigated in this branch by:

- [`package.json`](../../package.json) — `dev` script now reads `PSTDIO_API_HOST` (defaults to `localhost`).
- [`infra/local/compose.yaml`](../../infra/local/compose.yaml) — sets `PSTDIO_API_HOST=0.0.0.0`, `PSTDIO_API_URL=http://127.0.0.1:19841`, the wrapper install URL also uses `127.0.0.1`, and `pstdio projects create` is wrapped in a 10x retry loop.

This is a workaround, not a fix. Remaining work:

- Decide whether to make `serve` dual-stack (`hostname: "::"` with IPv6 disabling V6_ONLY) so a single bind covers both stacks.
- Or document the IPv4-only assumption inside dockerized dev and make the existing `--host 0.0.0.0` default rather than `localhost` when running under docker. A small refactor in [`packages/pstdio/src/adapters/cli/commands/serve/index.ts`](../pstdio/src/adapters/cli/commands/serve/index.ts) to read `PSTDIO_API_HOST` directly would let us drop the env-pass-through hop in the dev script.

## Out of scope here

- Adding any new contribution slot kinds (e.g. session-scoped slots) — the existing kernel slots are already enough to surface the lab.
- Wiring extension-contributed `resources` (e.g. tickets) into the command palette — explicitly deferred per the conversation that produced this branch.
- Production releases. While alpha, all changesets above stay at `patch` or `minor`, no `major` bumps.
