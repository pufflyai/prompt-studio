# Test the relay with two dashboards

Run this from the repository root:

```sh
bun run dev:relay
```

The command starts the real Better Auth manager, PostgreSQL, RustFS and relay, then runs two Prompt Studio dashboards through `dev:isolated`. It prints a **Notes** URL for each dashboard. Create a note in one dashboard and open it in the other. The launcher installs the unchanged Notes, Artifacts, and harness extensions, plus a small native controls fixture. Publish HTML through Artifacts or edit **Shared message** in **Relay test** to check other storage paths.

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

Two concurrent replacements can produce a retained conflict. The public grouped storage API exposes inspection and resolution. A stale native file editor save keeps its draft and reports a conflict. The platform carries the editor's read baseline; extension handlers do not need relay code.

Ordinary key/value storage, collections, uploaded blobs, and files in declared artifact mounts share the owner journal. The host imports existing artifact files and captures direct filesystem edits in those mounts, including agent saves. Incoming verified assets materialize in the other environment's own project folder. Renames and deletes enter the journal as file edits and tombstones. A private per-folder checkpoint records the last materialized file hashes and revisions so restarting does not mistake an old disk copy for a new edit.

Directory records carry stable identities. Children belong to that directory's lifetime, so a journaled deletion followed by recreation cannot revive its old files. Child writes claim their parent directories in the same operation. A competing file replacement or folder deletion becomes a retained conflict. Choosing a file or deletion replaces that whole directory lifetime; choosing the retained folder restores its children. Direct filesystem changes are captured as snapshots: removing and recreating a directory between observations counts as an edit to the existing folder. These are host storage rules, with no extension API changes.

Read-only workspace providers keep receiving the extension's journal and blobs. The host waits for file write access before materializing artifact files or creating filesystem watchers.

Harness sessions, messages, processes, terminals, workspace folders, credentials, caches, and unpublished extension source overrides stay local. `ctx.extensionFiles` contains an extension's local working files; files intended as shared outputs belong in declared artifact mounts. The launcher preinstalls the same published extension dependencies in both environments; it does not distribute unpublished source changes.

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
      "environmentId": "this-runtime-environment",
      "managerOrigin": "https://manager.example",
      "relayOrigin": "https://relay.example",
      "renewalGrant": "<private-enrollment-grant>"
    }
  ]
}
```

The environment must match `GET /v1/environment`. Each workbench appears once. Bind the workbench locally before connecting. The host discovers all enabled extensions and initializes their owner scopes through an authenticated request. Enabling another extension needs no configuration entry. Disabling it closes its connection. Source or workspace changes rebuild the host watchers. Scope initialization cannot overwrite an existing published revision. HTTPS is required except for owned loopback HTTP fixtures. Configuration is read at runtime startup; restart after changing it. Renewal grants stay in the native process and never enter browser requests, extension storage or snapshots.

Each connection runs one synchronization at a time. Local committed journal entries wake it. Versioned WebSocket hints also wake it; hints contain no records. The journal, receipts and snapshots own the state. Incoming assets are verified before publication, multipart upload staging uses temporary disk files, and failed source opening removes its spool. Shutdown aborts requests and closes connections before closing the local database.

The platform invalidates extension views after local commits and incoming snapshots. Native views and webview query subscriptions use the normal host refresh path. Extension builders need no synchronization event, refresh listener, relay configuration, or storage opt-in. The controls fixture deliberately uses only ordinary `ctx.storage.get/set` calls and declares no refresh events.

## Verification scope

Real manager/relay tests cover finite access, account isolation, PostgreSQL/S3 persistence, streamed assets and shutdown. Native integration tests cover two journals, renewal, serial wakeups, multipart staging and source-failure cleanup. The compiled smoke uses an owned wire peer to prove that the packaged host applies incoming data through the public SDK and retains it across restart; it is not a second production relay implementation.

The two live dashboards provide the end-to-end local check. This setup does not prove live Google configuration, provider hosting, backup operations, capacity or cost targets. Nothing is deployed or merged into main by this command.

The native database owner holds a SQLite OS write lock in `pstdio.db.lock.sqlite`. This file is only an ownership lock; application data stays in PGlite. Keep the lock file in place so every process locks the same inode. The OS releases ownership when a container dies. A nonempty legacy `pstdio.db.lock` fails closed: stop every runtime using that home before removing an abandoned legacy claim.
