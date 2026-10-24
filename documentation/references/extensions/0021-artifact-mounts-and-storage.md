# Artifact mounts and storage

Store extension data through owned records, assets, allocated files, and constrained artifact mounts.

`ctx.storage.records`, `ctx.storage.assets`, and the `.publishers/<publisher>/` file root are on `main` and in `0.44.0-nightly` builds. They ship in the release after 0.43.x; `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them. On 0.43.x, use `get`, `set`, `delete`, and `collection`, which are not deprecated there, and `ctx.extensionFiles` writes under `.pstdio/ext/<publisher>.<name>/`. See [storage availability](../sdk/0004-storage.md#availability).

`ctx.storage.records` saves related records as one durable group using the revisions
their caller observed. It supports shared text/list/map operations, JSON, immutable
asset references, tombstones, durable outcomes, and retained conflict resolution.
Local-only workbenches remain usable. See the [storage reference](../sdk/0004-storage.md)
and [save workflow](../../guides/sdk/0003-storage.md). KV and collection replacement
methods remain supported through the same owner and are deprecated in favor of
guarded record commits.

Commands and hooks also have `ctx.storage.assets` for immutable versioned bytes. `stage({ operationId, source })` accepts a `Blob` or `File`, resumes interrupted uploads, and returns `{ sha256, byteLength, mediaType }` only after verification. `getTransfer`, `cancel`, `read`, and `verifyComplete` expose progress, explicit cleanup, streamed reads, and reference verification. The owner is the current workbench and installed extension, shared across that extension's storage scopes. Completed versions remain retained. See the [asset guide](../../guides/sdk/0002-assets.md) and [public types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/assets.ts).

Existing `ctx.storage.files`, collection attachments, and webview file calls remain supported. Their HTTP bytes stream through local storage. `getBytes` still returns a full byte array by request. Blob IDs and asset references remain different contracts; no blob migration or API removal is required.

Keep every extension-owned project file under `.pstdio/extension-storage/<publisher>.<name>/`,
including configuration, caches, drafts, prototypes, evidence, and migration backups.
Use `ctx.extensionFiles` or artifact mounts for these files. See
[extension file storage](../../guides/extensions/0009-allocated-extension-files.md) for draft
locations and how to move files from older layouts.

Artifact mounts are constrained to the extension's full-ID root under each repo's extension storage directory. Prompt Studio 0.46 does not move or read files under the earlier `<package-name>/` root:

The first mount-path segment cannot be `.publishers`, including case variants.
That segment stays reserved from the API 0.2 allocated-file layout.

```txt
<repo>/.pstdio/extension-storage/<publisher>.<name>/...
```

For extension `acme.planner`, the default scoped root is:

```txt
<repo>/.pstdio/extension-storage/acme.planner/
```

Structured records and immutable assets are API-owned by stable extension and
workbench identity. Artifact mounts use the extension package's allocated file root.

Artifact mounts create their directories on the first write. Before that, `exists()` returns false and `list()` returns an empty array.

The mount's `path` is relative to that full-ID root. Its `id` is only the mount's local name. The
`id` appears in refs and capability grants, never in the disk path. For extension `acme.planner`,
`defineArtifactMount({ id: "runs", path: "runs", label: "Runs" })` resolves to
`<repo>/.pstdio/extension-storage/acme.planner/runs/`, and a read of `a/summary.json` targets
`<repo>/.pstdio/extension-storage/acme.planner/runs/a/summary.json`.

### Webview reads

A webview can read a mount its own extension defines by declaring the `artifacts.read` capability, scoped to
that mount:

```ts
import { artifactsRead, defineArtifactMount, defineView, packageAsset } from "@pstdio/sdk/extensions";

const runArtifacts = defineArtifactMount({ id: "runs", path: "runs", label: "Runs" });

const report = defineView({
  id: "report",
  title: "Run report",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/report.tsx", import.meta.url),
    capabilities: [artifactsRead(runArtifacts)],
  },
});
```

Each declaration grants exactly one mount; there is no wildcard, and `pst extensions check` fails a grant on a
mount the extension does not define (`webview_artifact_mount_missing`). All enforcement runs on the host:
reads stay inside the declared mount (traversal and symlink escapes are rejected before filesystem access),
text reads over 5 MB and images over 20 MB return limit errors instead of truncated content, and image URLs
are minted only for png, jpeg, webp, and gif. Image bytes are served through the capability-secured webview
asset channel with short-lived signed URLs that each cover one file ([ADR 0008](../../adrs/0008-capability-secured-extension-webview-assets.md)). Webviews never write to mounts; mutation
goes through commands.

### Watched mounts

Set `watch: true` on a mount to get an event when its files change outside the mount API. This happens
when an agent edits a file with its own tools, a script writes it, or a person saves it in an editor.
`artifactChanged(mount)` names the event. Native views, webviews, and hooks use the same ref:

```ts
import { artifactChanged, defineArtifactMount, defineHook } from "@pstdio/sdk/extensions";

export const boards = defineArtifactMount({ id: "boards", path: "boards", label: "Boards", watch: true });

// Native view body: reload after your own command event and after direct edits.
// refreshEvents: [boardsChanged, artifactChanged(boards)],

// Webview: refetch after a direct edit. The listener gets no payload.
// client.events.subscribe(artifactChanged(boards), refetch);

export const reindexBoards = defineHook({
  id: "reindex-boards",
  event: artifactChanged(boards),
  run: async (ctx, { paths }) => {
    const mount = ctx.artifacts.mount(boards.id);
    const targets = paths.length > 0 ? paths : (await mount.list("**/*.json")).map((file) => file.path);
    // Paths can name folders and removed files, so check before reading.
    for (const path of targets) {
      if (path.endsWith(".json") && (await mount.exists(path))) await indexBoard(ctx, path);
    }
  },
});
```

- The host watches the mount in the project's default workspace, the same copy that `ctx.artifacts`
  and webview reads use. It creates the mount folder when the watch starts, but never creates a
  removed workspace or mount folder again. A remote or not-ready default workspace has no watch,
  and worktree copies are never watched. Tell agents the absolute path, for example in your
  extension's skill.
- The resolved event id is `artifact.changed:<extension-id>.artifact.<mount-id>`.
- The payload is `{ projectId, mount, paths }`, plus the default workspace fields every host event
  carries. `paths` are relative to the mount root, use `/`, are sorted, and have no duplicates. They
  name changed files, and folders that were created, removed, or renamed. A path that no longer
  exists was removed; it can also be a short-lived file such as an editor's temp file.
- `paths: []` means "reload the whole mount". The host sends it when more than 200 paths changed at
  once, when the mount folder itself was removed, replaced, or came back, or when the mount has
  more than 2,000 folders, counting the mount folder, on Linux, where each folder needs its own OS
  watch.
- A burst of changes produces one event, 200 ms after the last change. While changes continue, a
  mount reports at most once per second.
- Writes, updates, and deletes through `ctx.artifacts.mount(...)` do not produce the event. Emit your
  own event from the command, as before. A hook can write into the mount it watches without
  triggering itself.
- A hook can watch another extension's mount with `artifactChanged({ id, extensionId })`. The payload
  has paths only; reading the files still needs the owner's commands.
- Events are hints. A client that reconnects reloads anyway, so a missed event is safe.

The decision is recorded in [ADR 0069](../../adrs/0069-host-owned-artifact-mount-watching.md).

