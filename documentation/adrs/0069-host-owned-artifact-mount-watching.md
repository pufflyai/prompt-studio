# Host-owned, opt-in watching of artifact mounts

Proposed: 2026-10-06

## Context

Artifact mounts are the files an extension keeps under `.pstdio/extension-storage/<name>/`. Agents and people edit those files directly, with their own file tools or editors. Before PS-534, open views did not refresh after such an edit, because only command code emitted refresh events.

Extensions cannot own a long-lived watcher. Command and hook handlers run in an invocation scope that ends when the call returns. Schedules are cron jobs that can only poll every minute. The host already ran two file watchers for extension code and had learned hard lessons about platform watch behavior (PS-21, PS-402, [lesson 0012](../lessons-learned/0012-linux-recursive-fs-watch-crawls-node-modules.md), [lesson 0014](../lessons-learned/0014-fatal-exit-skips-async-cleanup.md)).

This is the intended design, not a temporary workaround.

## Decision

1. The host owns the watch. An extension opts in per mount with `watch: true` on `defineArtifactMount`.
2. The host watches only the copy that mount calls use: the project's ready, local default workspace. It creates the mount folder when the watch starts.
3. The host emits one event per mount through the existing event dispatcher. The SDK helper `artifactChanged(mount)` names it. Its resolved id is `artifact.changed:<extension-id>.artifact.<mount-id>`, so hooks, native `refreshEvents`, and webview `events.subscribe` all match it.
4. The event reports only changes made outside the mount API. Mount writes, updates, and deletes are recorded in an in-memory write ledger, and the watcher drops their echoes. A hook can therefore write into the mount it watches without triggering itself.
5. A burst ends 200 ms after its last change. While changes continue, a mount reports at most once per second.
6. Platform watch logic lives in one shared directory-tree watcher, `packages/pstdio-extensions/src/fs-watch/directory-tree-watcher.ts`. The extension source watcher and the mount watcher both use it.

## Contract details

- Payload: `{ projectId, mount, paths }`, plus the default workspace fields every host event carries.
- `paths` are relative to the mount root, use `/`, are sorted, and have no duplicates. They name changed files and folders. A folder counts only when it is created, removed, or renamed. Windows also reports a folder as changed when an entry inside it changes; the host ignores that, because the entry has its own path.
- `paths: []` means "reload the whole mount". The host sends it when more than 200 paths changed in one burst, when the mount folder itself was removed, replaced, or came back, or when a mount has more than 2,000 folders, counting the mount folder, on a platform that needs one watch per folder (Linux). Past that limit the host stops adding folder watches, logs one warning, and every later event from that mount carries `paths: []`.
- On Linux, each folder has its own watch handle, and a handle follows one folder object. A new folder can fill up before its handle starts, so the host reports the entries it finds when it adds the handle. The host stores each watched folder's device, inode, and birth time; Linux reuses inodes at once, so the birth time tells a new folder apart. When a folder is removed or replaced, its handle is dropped and the folder is watched again when it is back. Nothing above the mount folder is watched, so when the mount folder itself is removed, the host checks once per second for it to return. It never creates a removed folder again. macOS and Windows use one recursive handle per mount, which follows the path through those changes.
- The host creates the mount folder only when a watch starts, and only inside a default workspace folder that exists.
- A path that no longer exists was removed. It can also be a short-lived file, such as an editor's temp file. macOS reports a file that was created and deleted quickly as one event after it is gone, so the host cannot tell the two cases apart without keeping a second copy of the mount listing. Listeners treat a missing path as removed, which is harmless for a file they never saw.
- The write ledger matches a recorded write by path, size, and modification time. File systems store that time in steps of 1 ms or more, so a direct edit that keeps the size and lands within the same step is dropped. The next edit still reports. Entries are removed when they match or after 5 seconds. Only watched mounts record their writes. A write through a linked file is recorded at the file it changes, which is the path the watcher reports.
- A hook can subscribe to another extension's mount with `artifactChanged({ id, extensionId })`, like `commandEvent` on another extension's command. The payload carries paths only; reading the files still needs the owner's commands.
- Events are hints. A client that reconnects reloads anyway, so a missed event is safe.

## Options considered

| Option | Result |
| --- | --- |
| A. Status quo: agents must use extension commands | Rejected as the only answer. It works for agents that know the commands, but not for a person's own editor or generic scripts. |
| B. Extensions poll with a schedule | Rejected. Minute-level steps, a full rescan per run, and every extension rebuilds the same thing. |
| C. Give extensions a raw `ctx.files.watch` API | Rejected. It needs a long-lived extension lifetime that does not exist, and it moves platform watcher limits into every extension. |
| D. Watch every mount, no flag | Rejected. On Linux each folder costs one OS watch. `pstdio-artifacts` keeps revision folders that no view needs to watch. |
| E. Derive the watch set from `refreshEvents` and hooks that name the event | Rejected for now. Webview subscriptions happen at run time and do not appear in the manifest. |
| F. One global `artifact.changed` event with the mount in the payload | Rejected. Webviews match by event id only, so every mount change would refresh every subscribed view of every extension. |
| G. Host-owned per-mount event, opt-in (chosen) | One owner, no new delivery channel, the same pattern as `commandEvent`, and no cost for unwatched mounts. |

## Consequences

- Positive: views stay current under direct edits, and hooks can react to them.
- Positive: the watch set is not stored. The host derives it from the runtime snapshots and default workspaces, and reconciles when extension instances, installed sources, projects, or workspaces change.
- Negative: a new optional manifest field and a new event family to keep stable.
- Negative: the write ledger is new in-memory state. It is created by mount writes, removed on its first match or after 5 seconds, and owned by the host process.
- Negative: Linux folder watches count against the OS limit. The 2,000-folder limit per mount bounds that cost.
- Neutral: worktree and remote workspaces are not watched, because mounts do not resolve there.

## Verification

- `packages/pstdio-extensions/src/fs-watch/directory-tree-watcher.test.ts`: new folder registration, entries written before a handle starts, folders removed and created again, a folder replaced by a file, symlink skip, folder limit, close. The per-folder tests also run on Linux.
- `packages/pstdio-api/src/features/extensions/artifact-mount-watch/*.test.ts`: one event per burst, echo drop for mount writes and deletes, the once-per-second limit, the 200-path and folder limits, a removed mount folder, hooks that write into their own mount, reconcile on a moved default workspace and a disabled extension, and a dispose that waits for running reconciles and hooks.
- `packages/sdk/src/extensions/webview-events.test.ts`: `artifactChanged(mount)` resolves to `artifact.changed:<extension-id>.artifact.<mount>`.
- The existing source watcher tests stay green on the shared tree watcher.
- `packages/e2e/src/ui/artifact-mount-watch.spec.ts`: an open webview refreshes after a direct file edit, and a mount write through a command does not refresh it.
