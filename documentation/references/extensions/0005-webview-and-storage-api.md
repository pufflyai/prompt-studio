# Extension webviews and storage

Part of the [extension API reference](0001-api.md).

## Webview Client

Webviews talk to the host through a typed client instead of raw `host.call` strings.
`createWebviewClient` builds one from the extension's exported commands record and
settings contribution. Import both as types only, so no server code enters the webview
bundle.

```tsx
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import type { commands } from "../commands";
import type { settings } from "../settings";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof commands, typeof settings>(host);
    // ...
  },
});
```

- `client.commands` has one function per command key. Params come from the command's
  `params` schema and the result from its `run` return type. Bare keys resolve inside
  the declaring extension; the host bridge provides the extension id. Failed outcomes
  throw with the outcome reason.
- `client.settings` has typed `all`, `get`, and `set` from the settings contribution.
  Declare the settings contribution `as const` and export it so the types stay precise.
- `client.artifacts` has `list(mount, prefix?)`, `readText(mount, path)`, and
  `imageUrl(mount, path)` for artifact mounts the webview declared with
  `artifactsRead(mount)` (see "Artifact Mounts And Storage"). `imageUrl` returns a short-lived URL
  for png, jpeg, webp, or gif, usable in `<img src>`; request a fresh URL when one
  expires. Undeclared mounts are denied by the capability gate with the exact missing
  declaration, such as `artifacts.read:runs`.
- The `files` render helper picks local files and stores extension-owned files. See
  [Webview files](#webview-files).
- `navigation.open` opens an explicit page or panel target. See
  [Navigate from a webview](#navigate-from-a-webview).
- Author commands with `defineCommand`. Commands written as inline literals inside
  `defineExtension` keep untyped results (see ADR 0012 in the repository docs).
- Pass `{ extensionId }` as the second argument only in tests, where no host bridge
  provides one.

### Webview files

`defineExtensionView` passes a `files` client to `render`. `pick` opens the browser's
file picker and does not contact the host. Upload, list, and delete cross the webview
bridge, so the view must declare each method it calls.

```ts
const imports = defineView({
  id: "imports",
  title: "Imports",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/imports.ts", import.meta.url),
    capabilities: ["files.upload", "files.list", "files.delete"],
  },
});
```

| Method | Declaration | Input | Result |
| --- | --- | --- | --- |
| `files.pick(options?)` | None | `{ accept?, multiple? }` | Browser `File[]`; an empty array means the user cancelled. |
| `files.upload(input)` | `files.upload` | `{ name, data, mimeType?, scope? }` | The stored `ExtensionBlobRef`. `data` accepts `Uint8Array` or `ArrayBuffer`. |
| `files.list(input?)` | `files.list` | `{ scope? }` | `ExtensionBlobRef[]` for the exact scope. |
| `files.delete(id)` | `files.delete` | A file id returned by upload or list. | Resolves after the host deletes the owned file. |

```ts
import { defineExtensionView } from "@pstdio/sdk/extensions";

export default defineExtensionView({
  async render({ files, mount }) {
    const [selected] = await files.pick({ accept: ".csv,text/csv" });
    if (!selected) return;

    const uploaded = await files.upload({
      name: selected.name,
      data: await selected.arrayBuffer(),
      mimeType: selected.type || "text/csv",
    });

    const projectFiles = await files.list();
    mount.textContent = `${uploaded.name} is one of ${projectFiles.length} stored files.`;

    // Delete the file when the extension no longer needs it.
    // await files.delete(uploaded.id);
  },
});
```

The host, not the guest, selects the active project and extension instance. A webview
cannot use a request field to read or write another extension's files. The optional
scope only groups files inside that owner boundary:

| Scope | Webview value | Meaning |
| --- | --- | --- |
| Project | Omit `scope` or use `{ type: "project" }` | Files shared by this extension across the active project. |
| Resource | `{ type: "resource", id: resourceId }` | Files grouped under one resource id. |
| Extension-defined | `{ type: "import", id: importId }` | Files grouped by a type and id chosen by the extension. Include the id when a command must access the scope. |

Upload and list must use the same scope to find the same files. The default project
scope matches `ctx.storage.files` in commands. A command can read the bytes without a
second upload:

```ts
const contents = await ctx.storage.files.getBytes(params.fileId);
```

The command storage API names the same scopes with runtime objects, not the webview
`{ type, id }` shape:

| Webview scope | Matching command storage |
| --- | --- |
| Omitted or `{ type: "project" }` | `ctx.storage.files` |
| `{ type: "resource", id: resource.id }` | `ctx.storage.scope({ type: "resource", resource }).files`, where `resource` is the full `{ type, id, ... }` resource reference. |
| `{ type: "import", id: importId }` | `ctx.storage.scope({ type: "import", id: importId }).files` |

Resource scopes use a full resource reference. Extension-defined command scopes
require an id. The upload limit is 25 MiB. The
returned `ExtensionBlobRef` contains `id`, `name`, `mimeType`, `size`, `hash`, `url`,
`createdAt`, and `updatedAt`.

Host-backed file methods need a project extension instance. They are available to
declared project pages, panels, and project settings views. A global
settings view has no project file owner, so it does not receive these methods. Keep
`files.pick` available there only when selecting a local file without uploading it.

The declaration gate still applies. If the view omits a declaration, the bridge rejects
the call before it reaches the file host.

### Navigate from a webview

Add `navigation.open` to the view and pass an explicit page or panel target:

```ts
const details = defineView({
  id: "details",
  title: "Details",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/details.ts", import.meta.url),
    capabilities: ["navigation.open"],
  },
});
```

```ts
await host.call("navigation.open", {
  target: {
    kind: "page",
    page: { kind: "page", id: "ticket" },
    resource: {
      type: "ticket",
      id: "PS-260",
      label: "Dashboard webview capabilities",
      metadata: { status: "in-review" },
    },
  },
});
```

The target chooses the destination. A resource supplies identity and input only. The
dashboard does not search for a matching screen by resource kind. The bridge rejects
the call if the view did not declare `navigation.open` or the target is invalid.

`@pstdio/sdk/extensions/react` ships react-query hooks built on the client. `react` and
`@tanstack/react-query` are optional peer dependencies used only by this entry.

```tsx
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";

const statuses = useCommandQuery({
  queryKey: ["ticket-statuses"],
  command: client.commands["ticket-status.read"],
});

const saveStatus = useCommandMutation({
  command: client.commands["ticket-status.update"],
  invalidate: [["ticket-statuses"]],
});
```

## Terminal Sessions

On Linux and macOS, supported interactive Bash and Zsh shells report activity while
running commands, including builtins such as `read`. Waiting or editing at the prompt
is idle. Background and stopped jobs do not count as foreground work. A directly
launched program counts as active until it exits. Custom shell invocations, shells with
unavailable prompt hooks, and unknown process state conservatively report activity.

Terminals are layered: the workbench-native terminal surface is the product UI, and `terminal.session` is the low-level host service behind it.

- **Runtime contexts** get `ctx.terminal` (an `ExtensionTerminalApi`) when the host wires a PTY supervisor. `ctx.terminal.openSession(request)` returns a host-side `TerminalSessionHandle` with `write`, `resize`, `kill`, and a single-consumer `events()` iterable. The handle never crosses into renderer code.
- **Webviews** declare the `terminal.session` capability — the only public webview terminal capability for this version. Calls are serializable operations (`open`, `write`, `resize`, `kill`, `subscribe`); `open` returns only a `sessionId`, and output/exit events are pushed through the bridge host-event channel. Use `createTerminalSessionBridge(host)` from `@pstdio/sdk/extensions` to get a bridge that plugs into the `Terminal` component from `@pstdio/ui/terminal`. Undeclared webviews are rejected by the capability gate.
- **Lifecycle ownership**: workbench-surface sessions live in `workbench.terminal`; closing the terminal panel kills its session, and disposing the controller kills every live session. A session opened through `ctx.terminal` belongs to the invocation that opened it and is killed when that invocation ends. The app-scoped PTY supervisor is the shutdown backstop: it force-kills whatever is still live when the app exits.
- **Stopping a session**: `kill()` signals the session's process group, so the shell and everything it started stop together. The default signal is `SIGHUP`, which shells honour even while they ignore `SIGTERM`, and the group is then swept with `SIGKILL` because a shell exiting does not prove its children did. The call always settles. A job that puts itself in its own process group and ignores the hangup survives, which is the same `nohup` behaviour every terminal has.
- **Dashboard transport**: the dashboard backs `workbench.terminal` with the API terminal transport — `POST /v1/terminal/sessions` opens a PTY on the app supervisor, the SSE `events` endpoint streams base64 output chunks and the exit event, and stdin/resize/kill address the session id. Dashboard extension webviews that declare `terminal.session` get live sessions through this path.
- **Diagnostics** log lifecycle metadata only (session id, pid, exit code, signal) — PTY content is never logged.

## Package Assets

Use `packageAsset()` for files shipped inside the extension package.

Template files are extension defaults, not host records. If users can edit them, declare a template type with `list`, `read`, `save`, and `delete` command refs. Keep overrides in `ctx.storage` and read untouched defaults through `ctx.packageFiles`. The dashboard discovers the type and calls those commands; it does not know the extension's storage format.

The command values use these shapes:

- `list`: returns `{ name, title, type }[]`.
- `read`: accepts `{ name }` and returns `{ name, title, type, content } | null`.
- `save`: accepts `{ name, title?, type, content }` and returns the saved item.
- `delete`: accepts `{ name }`.

```ts
import { defineTemplate } from "@pstdio/sdk/extensions";
import { defineExtension, defineView, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  templates: [
    defineTemplate({
      id: "ticket",
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/ticket.md", import.meta.url),
    }),
  ],
  views: [
    defineView({
      id: "planner",
      title: "Planner",
      body: {
        kind: "webview",
        entry: packageAsset("./webviews/planner.tsx", import.meta.url),
      },
    }),
  ],
});
```

Package asset paths must be relative and stay inside the package.

Command and hook handlers can read other packaged files through `ctx.packageFiles`. This API is read-only and scoped to the installed package root. Files omitted from an installed copy by `.gitignore` are unavailable at runtime.

Set `pstdio.projectFiles.tracked` in the package manifest to control the allocated `ctx.extensionFiles` repo mount. It is rooted at `.pstdio/ext/<publisher>.<name>/`. The host adds an ignore entry on the first write unless `tracked` is true.

## Artifact Mounts And Storage

Artifact mounts are constrained to a package-name root under each repo's extension storage directory:

```txt
<repo>/.pstdio/extension-storage/<package-name>/...
```

For package `planner`, the default scoped root is:

```txt
<repo>/.pstdio/extension-storage/planner/
```

Extension storage is API-owned and scoped by extension instance. Project-owned storage also carries the project id.

Artifact mounts create their directories on the first write. Before that, `exists()` returns false and `list()` returns an empty array.

The mount's `path` is relative to that package-name root, and its `id` is only the mount's local name — it
appears in refs and capability grants, never in the disk path. For package `planner`,
`defineArtifactMount({ id: "runs", path: "runs", label: "Runs" })` resolves to
`<repo>/.pstdio/extension-storage/planner/runs/`, and a read of `a/summary.json` targets
`<repo>/.pstdio/extension-storage/planner/runs/a/summary.json`.

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
asset channel with short-lived, fully-bound signed URLs (ADR 0008). Webviews never write to mounts; mutation
goes through commands.

## Client events and workspace scope

`createWebviewClient` exposes `commands`, `settings`, `artifacts`, and `events`. Subscribe through the events client and dispose subscriptions when the view unmounts. Pass `{ workspaceId }` when commands need a specific workspace; omitted commands use the project's default workspace. The client defaults to the host's calling extension ID; a type-only import does not change routing. See the [client contract](../../../packages/sdk/src/extensions/webview-client.ts) for signatures and options.
