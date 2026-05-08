# Manual test — extension-lab end-to-end

Smoke check that runs the full extension stack against `extensions/extension-lab` in dockerized dev. Use this whenever you touch:

- `pstdio-extensions` (loader, normalizer, runtime)
- `packages/pstdio-api/src/features/extensions/*` (routes, command runtime, source watcher, webview build manager)
- `packages/pstdio-dashboard/src/shared/extensions/*` (`useProjectExtensionMetadata`, `useExecuteExtensionCommand`, slot host components)
- The dispatcher / command palette wiring

## 1. Bring up dev:isolated

```bash
bun run dev:isolated -- --name lab
```

Wait for the printed `Dashboard: http://localhost:<port>/` line. The compose stack is configured for IPv4-only loopback ([compose.yaml](../../infra/local/compose.yaml)) so `Bun.serve` and the CLI wrapper agree; without that, `pstdio projects create` fails inside the container.

If the demo project never gets created, look for `projects create attempt N failed; retrying in 2s` in `docker logs lab-prompt-studio-1` — the boot script retries 10x.

## 2. Install extension-lab into the demo project

The repo is bind-mounted into the container at the host path. Use the absolute path:

```bash
docker exec -it lab-prompt-studio-1 bash
cd /workspace/project
pstdio extensions add /Users/<you>/.pstdio-dev/workspaces/<branch>/extensions/extension-lab
pstdio extensions check
```

Expected `check` output:

```
Extensions found: 1
Commands: 7
Warnings: 0
Errors: 0
```

## 3. Backend smoke test (no UI needed)

From the same container shell. `$PID` is the demo project id from `pstdio projects list`.

```bash
PID=$(pstdio projects list | tail -n +2 | head -1 | awk '{print $1}')

# 1. List commands
curl -s "http://127.0.0.1:19841/v1/projects/$PID/extensions/commands" | jq .

# 2. Execute a command
curl -s -X POST "http://127.0.0.1:19841/v1/projects/$PID/extensions/commands/lab.say-hello/execute" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PID\",\"source\":\"dashboard\"}" | jq .
```

| Check                                                                              | Expected                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands` length                                                                  | 7                                                                                                                                                 |
| Each command has `id`, `extensionId`, `namespace`, `title`                         | yes                                                                                                                                               |
| `GET /v1/projects/:id/extensions/ui` returns the rich `DashboardExtensionMetadata` | `extensions`, `commands`, `menuContributions`, `views`, `routes`, `navigation`, `settingsPanels`, `diagnostics`                                   |
| `menuContributions` slotIds include `project.commandPanel`                       | five lab commands slot themselves in: `say-hello`, `counter.bump`, `counter.read`, `counter.reset`, `demo.try-awaken` (no `awaken`, no `heartbeat`) |
| `lab.say-hello` execute → `outcome.status === "success"`                           | yes                                                                                                                                               |
| `outcome.notices[0]` contains `"Hello from the lab"`                               | yes                                                                                                                                               |

## 4. Schedule sanity

Lab registers a 1-minute heartbeat. With the project loaded, watch:

```bash
docker logs lab-prompt-studio-1 -f | grep heartbeat
```

You should see `[plugin:schedule] minute-heartbeat project=<id> scheduledFor=<iso>` once per minute.

## 5. Dashboard verification

Open the printed dashboard URL and click into the demo project (`/projects/<id>/tickets`).

| Surface                        | Expected                                                                                                                            | Notes                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Sidebar nav                    | A **Lab** entry below `Tickets`                                                                                                     | sourced from the `project.sidebarNav` navigation contribution                    |
| Header — primary slot          | **Lab: Say hello** button (clicks dispatch `lab.say-hello`)                                                                         | sourced from the `project.headerPrimary` menu contribution                       |
| Header — overflow `⋯`          | `Bump lab counter`, `Reset lab counter`, `Demo middleware rejection`                                                                | sourced from the `project.headerOverflow` menu contributions                     |
| `/projects/:id/extensions/lab` | Lab route shell mounts (sidebar + breadcrumb)                                                                                       | iframe content rendering depends on webview-asset serving — see Known gaps below |
| Sidebar view slot (right rail) | Lab webview cards                                                                                                                   | empty unless lab declares `views`; covered when sidebar `view` slot is enabled   |
| `Cmd+Shift+P` → `>`            | **Extension Lab** group with the commands the lab explicitly slots into `projectSlots.commandPanel` (no `awaken`, no `heartbeat`) | five entries: Say hello, Bump/Read/Reset lab counter, Demo middleware rejection  |
| Click an Extension Lab entry   | Toast fires (same content as backend smoke test)                                                                                    | dispatches via `executeExtensionCommand`                                         |

If any row fails, check the browser console first.

## 6. CLI cross-check

```bash
pstdio lab --help
pstdio lab say-hello              # toast on the open dashboard
pstdio lab counter bump           # increments per-project storage
pstdio lab counter read           # confirms persisted value
pstdio lab counter reset
pstdio lab demo try-awaken        # middleware rejects → hook reacts (two toasts)
```

The CLI uses the same `executeExtensionCommand` runtime as the dashboard, so any divergence between CLI success and dashboard failure points at the dashboard bridge.

## 7. Tear down

```bash
exit                                            # leave the container shell
bun run dev:isolated -- --name lab --down       # destroys volumes
```

## Known gaps (do not block the test)

1. The lab route's iframe loads its webview entry from a `file:///` URL the browser refuses to load over HTTP. The dashboard's `ExtensionWebviewFrame` needs to translate `webview.entry` (a `packageAsset` descriptor) onto the API's `/extensions/installed/<installName>/webviews/*` route before iframe content renders. Tracked separately from the slot wiring covered here.

Both items are tracked in [NEXT_STEPS.md](./NEXT_STEPS.md).
