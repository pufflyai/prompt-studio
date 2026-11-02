# Test the relay with two dashboards

Run this from the repository root:

```sh
bun run dev:relay
```

The command starts the real Better Auth manager, PostgreSQL, RustFS and relay, then runs two Prompt Studio dashboards through `dev:isolated`. It prints a **Notes** URL for each dashboard. Create a note in one dashboard and open it in the other. The launcher installs the unchanged Notes, Artifacts, and harness extensions, plus a small native controls fixture. Publish HTML through Artifacts or edit **Shared message** in **Relay test** to check other storage paths.

Each app has its own environment identity, home, PGlite database, project folder, API token and device login. Both apps are devices of the same fixture account. Both bind the same shared workbench identity, which is a cloud project of that account. Dependency files and their Bun cache share one Docker volume; runtime data and credentials do not. Keeping the cache on the dependency filesystem lets Bun hardlink packages instead of copying them across volume mounts. See [Bun's cache documentation](https://bun.com/docs/pm/global-cache).

The local fixture uses its own account and operator enrollment. It needs no real Google login or cloud account. The production manager uses Better Auth's Google provider and requires real provider settings. Fixture enrollment is absent from the production manager image.

The manager and relay use separate PostgreSQL roles. Native connections use HTTPS with fresh fixture certificates and separate server private keys. The relay receives public signing trust; it receives no manager database role, signing secret or device token. Dashboard and API ports bind to host loopback. The fixture's Docker network defaults to 10.254.239.0/24. Inspect existing networks before choosing another `RELAY_TEST_SUBNET`.

## Native Markdown checks

Open the same Notes document in both dashboards. Type different text in separate
paragraphs, then place a selection in each editor. Both text changes must converge;
the other connection's caret and selection should appear and follow scrolling.
Close one tab and confirm its presence disappears.

Check the complete artifact Markdown in each isolated project folder. Front matter
must keep its original bytes when the body changes. Make an outside edit in a
different paragraph while one dashboard has an editor change waiting; both changes
must survive. Repeat with one relay connection offline and after restarting that
app. Check the saved text independently of presence: no participant, caret or
selection data belongs in its database journal or source files.

Native collaboration requires an explicit full-source `documentSource` declaration
from the view. For Notes and Planner checks, first install the source declarations
from [PR #1508](https://github.com/pufflyai/prompt-studio/pull/1508): Notes uses its
artifact; Planner uses its body field and stable file blobs. Other views retain
their ordinary load/save behavior. See
[shared Markdown sources](../../references/extensions/0012-renderer-edit-refresh-lifecycle.md#shared-markdown-sources).

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

Use the same name when rerunning. The first run of a new name can stop with `TypeError: The socket connection was closed unexpectedly` from `scripts/dev/relay-local.ts`. Each app installs the default extensions into its own home, and the first `pstdio-artifacts` install downloads about 450 MB of dependencies. It took 46 to 79 seconds here. The setup request waits for that install and the API closes the idle connection first. Run the same command again after the app's log shows the install finished; in one check, the third run succeeded after 43 seconds. A rerun keeps an app's saved login while the manager still accepts its token. If the manager rejects the token, or no login is saved, the launcher enrolls the app's device again. Enrolling replaces the device token, so the old token stops working. Cleanup removes only that named fixture's apps, homes, database/object volumes and dependency volume. It does not prune Docker globally.

Connection files and account files live under ignored `__test-tmp__/dev-isolated/<app>/` and `__test-tmp__/relay/<name>/`. Treat these files as credentials. Do not commit or attach their contents to reports.

## Native runtime configuration

The host keeps one device login in a private JSON file. By default the file is `native-account.json` beside the database. `PSTDIO_ACCOUNT_FILE` selects another path. In normal use, the host writes this file when you log in with `pst login`. The local launcher writes it for each app at `__test-tmp__/dev-isolated/<app>/pstdio-home/account.json` with mode 0600. `infra/local/compose.relay.yaml` points `PSTDIO_ACCOUNT_FILE` at that path.

```json
{
  "login": {
    "managerOrigin": "https://manager.example",
    "relayOrigin": "https://relay.example",
    "accountId": "account",
    "deviceId": "this-runtime-environment",
    "token": "<private-device-token>"
  }
}
```

`"login": null` means the host is logged out. A missing file means the same. A logged-out host stays local. The device ID is the host's environment ID from `GET /v1/environment`. One device token covers every cloud project of the account. A cloud project is a workbench that the manager lists for the account.

At startup, a logged-in host asks the manager for its account's cloud projects with `GET /v1/workbenches`. It syncs the cloud projects that exist locally. A cloud project starts to sync once it is created or bound on this host. The host asks the manager again after login, logout and local project changes. If the manager rejects the token, for example because another device removed this one, the host clears the login and stays local. The host does not watch the file, so the launcher restarts an app after it writes a new login.

The local fixture enrollment adds the shared workbench to the fixture account and registers the app's environment ID as a device. It does not go through Google login.

The host discovers all enabled extensions and initializes their owner scopes through an authenticated request. Enabling another extension needs no configuration entry. Disabling it closes its connection. Source or workspace changes rebuild the host watchers. Scope initialization cannot overwrite an existing published revision. HTTPS is required except for owned loopback HTTP fixtures. The device token stays in the native process. It never enters browser requests, host API responses, extension storage or snapshots.

Each connection runs one synchronization at a time. Local committed journal entries wake it. Versioned WebSocket hints also wake it; hints contain no records. The journal, receipts and snapshots own the state. Incoming assets are verified before publication, multipart upload staging uses temporary disk files, and failed source opening removes its spool. Shutdown aborts requests and closes connections before closing the local database.

The platform invalidates extension views after committed storage changes, local or downloaded. A sync round that changes nothing sends no refresh. Writes that land close together send one storage change per project, and only that project's views reload. Reconnecting still reloads every view. Views reload for any owner's change in their project, because a view can read another extension's data through its public commands. Native views and webview query subscriptions use the normal host refresh path. Extension builders need no synchronization event, refresh listener, relay configuration, or storage opt-in. The controls fixture deliberately uses only ordinary `ctx.storage.get/set` calls and declares no refresh events.

## Verification scope

Real manager/relay tests cover finite access, account isolation, PostgreSQL/S3 persistence, streamed assets and shutdown. Native integration tests cover two journals, renewal, serial wakeups, multipart staging and source-failure cleanup. The compiled smoke uses an owned wire peer to prove that the packaged host applies incoming data through the public SDK and retains it across restart; it is not a second production relay implementation.

The two live dashboards provide the end-to-end local check. This setup does not prove live Google configuration, provider hosting, backup operations, capacity or cost targets. Nothing is deployed or merged into main by this command.

The native database owner holds a SQLite OS write lock in `pstdio.db.lock.sqlite`. This file is only an ownership lock; application data stays in PGlite. Keep the lock file in place so every process locks the same inode. The OS releases ownership when a container dies. A nonempty legacy `pstdio.db.lock` fails closed: stop every runtime using that home before removing an abandoned legacy claim.
