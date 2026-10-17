# Test the relay with two dashboards

Run this from the PS-775 stack checkout:

```sh
bun run dev:relay
```

The command starts the real Better Auth manager, PostgreSQL, RustFS and relay, then runs two Prompt Studio dashboards through `dev:isolated`. It prints a **Relay test** URL for each dashboard. Open both URLs and edit **Shared message**. A save on either side should appear on the other side.

Each app has its own environment identity, home, PGlite database, project folder, API token and relay renewal grant. Both bind the same shared workbench identity. Dependency files and their Bun cache share one Docker volume; runtime data and credentials do not. Keeping the cache on the dependency filesystem lets Bun hardlink packages instead of copying them across volume mounts. See [Bun's cache documentation](https://bun.com/docs/pm/global-cache).

The local fixture uses its own account and operator enrollment. It needs no real Google login or cloud account. The production manager uses Better Auth's Google provider and requires real provider settings. Fixture enrollment is absent from the production manager image.

The manager and relay use separate PostgreSQL roles. Native connections use HTTPS with fresh fixture certificates and separate server private keys. The relay receives public signing trust; it receives no manager database role, signing secret or renewal grant. Dashboard and API ports bind to host loopback. The fixture's Docker network defaults to 10.254.239.0/24. Inspect existing networks before choosing another `RELAY_TEST_SUBNET`.

## Offline and restart checks

With the default name:

```sh
docker stop relay-local-relay-relay-1
# Edit Shared message in one dashboard. Its save remains local.
docker start relay-local-relay-relay-1
```

After reconnect, the saved journal should reach the other app. The client uses bounded reconnect backoff and retains local operations while disconnected. Its access cache remains usable through the original token expiry. Only renewal needs the manager. The fixture issues five-second access tokens so normal use also exercises expiry and renewal.

Restart one app to verify that its environment and saved state survive:

```sh
docker restart relay-local-a-prompt-studio-1
```

Two concurrent replacements can produce a retained conflict. The demo is a small storage surface; it does not provide a conflict editor. The public grouped storage API exposes inspection and resolution. Existing Notes and Planner file workflows are separate from this demo and are not claimed to synchronize all their files.

## Naming and cleanup

```sh
bun run dev:relay -- --name=my-relay
bun run dev:relay -- --name=my-relay --down
```

Use the same name when rerunning. Existing native credentials are retained. If enrollment was interrupted before its config was saved, a new fixture enrollment revokes the environment's old grants and creates a fresh one. Cleanup removes only that named fixture's apps, homes, database/object volumes and dependency volume. It does not prune Docker globally.

Connection files live under ignored `__test-tmp__/dev-isolated/<app>/` and `__test-tmp__/relay/<name>/`. Treat these files as credentials. Do not commit or attach their contents to reports.

## Native runtime configuration

An operator supplies a private JSON file outside shared project content and starts the runtime with `PSTDIO_RELAY_CONFIG_FILE` pointing to it. The local launcher writes this file under each app's isolated home with mode 0600.

```json
{
  "connections": [
    {
      "accountId": "account",
      "workbenchId": "workbench",
      "extensionId": "publisher.extension",
      "environmentId": "this-runtime-environment",
      "managerOrigin": "https://manager.example",
      "relayOrigin": "https://relay.example",
      "renewalGrant": "<private-enrollment-grant>"
    }
  ]
}
```

The environment must match `GET /v1/environment`. Each workbench/extension owner appears once. Bind the workbench locally and initialize its published relay scope before connecting. HTTPS is required except for owned loopback HTTP fixtures. Configuration is read at runtime startup; restart after changing it. Renewal grants stay in the native process and never enter browser requests, extension storage or snapshots.

Each connection runs one synchronization at a time. Local committed journal entries wake it. Versioned WebSocket hints also wake it; hints contain no records. The journal, receipts and snapshots own the state. Incoming assets are verified before publication, multipart upload staging uses temporary disk files, and failed source opening removes its spool. Shutdown aborts requests and closes connections before closing the local database.

After a new accepted snapshot, native views can refresh through `eventRef({ extensionId: "publisher.extension", id: "storage-changed" })`. The event is a view invalidation; its payload contains no shared content or credentials. The demo uses existing public `ctx.storage.get/set` calls and native controls.

## Verification scope

Real manager/relay tests cover finite access, account isolation, PostgreSQL/S3 persistence, streamed assets and shutdown. Native integration tests cover two journals, renewal, serial wakeups, multipart staging and source-failure cleanup. The compiled smoke uses an owned wire peer to prove that the packaged host applies incoming data through the public SDK and retains it across restart; it is not a second production relay implementation.

The two live dashboards provide the end-to-end local check. This setup does not prove live Google configuration, provider hosting, backup operations, capacity or cost targets. Nothing is deployed or merged into main by this command.

The native database owner holds a SQLite OS write lock in `pstdio.db.lock.sqlite`. This file is only an ownership lock; application data stays in PGlite. Keep the lock file in place so every process locks the same inode. The OS releases ownership when a container dies. A nonempty legacy `pstdio.db.lock` fails closed: stop every runtime using that home before removing an abandoned legacy claim.
