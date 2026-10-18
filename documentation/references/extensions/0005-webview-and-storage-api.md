# Webviews and storage

Use the typed webview client for commands, files, navigation, preferences, and host context.

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
- `client.settings` has typed `all`, `get`, `set`, and `delete` from the settings contribution.
  Declare the settings contribution `as const` and export it so the types stay precise.
  `await client.settings.delete(key)` removes the stored override and restores its declared fallback.
  `set` returns the saved value, including changes made by the host.
  Deletion does not store `null`; declare the `extension.settings.delete` capability.
- `client.artifacts` has `list(mount, prefix?)`, `readText(mount, path)`, and
  `imageUrl(mount, path)` for artifact mounts the webview declared with
  `artifactsRead(mount)` (see [Artifact mounts and storage](#artifact-mounts-and-storage)). `imageUrl` returns a short-lived URL
  for png, jpeg, webp, or gif, usable in `<img src>`; request a fresh URL when one
  expires. Undeclared mounts are denied by the capability gate with the exact missing
  declaration, such as `artifacts.read:runs`.
- `client.files` picks local files and stores extension-owned files. See
  [Webview files](#webview-files).
- `client.navigation.open` opens an explicit page or panel target. See
  [Navigate from a webview](#navigate-from-a-webview).
- Author commands with `defineCommand`. Commands written as inline literals inside
  `defineExtension` keep untyped results (see [ADR 0012](../../adrs/0012-temporary-webview-client-type-source.md)).
- Pass `{ extensionId }` as the second argument only in tests, where no host bridge
  provides one.

### View render context

`render` receives one context object. These parts are in 0.43.x and `main`, except `page`:

| Member | What it does |
| --- | --- |
| `mount` | The DOM element the view renders into. |
| `host.call(method, params?)` | Calls a host capability that the webview declared. |
| `host.onEvent(scope, handler)` | Listens to host messages on one scope and returns an unsubscribe function. The webview events client uses the `extension.events` scope; prefer it for extension events. |
| `files` | Picks local files and stores extension-owned files. See [Webview files](#webview-files). |
| `propsStore.get()` | Returns the current props the host passed to the view. |
| `propsStore.subscribe(listener)` | Calls `listener` with new props whenever the host changes them. Returns an unsubscribe function. |
| `page` | Reads and updates page params. On `main` only; it ships in the release after 0.43.x. See [Page params](#page-params). |
| `locale`, `t` | The active locale and a translation helper. |

### Webview files

Use `client.files`. The old render-context `files` helper is deprecated through 0.44.
`pick` opens the browser's
file picker and does not contact the host. Upload, list, and delete cross the webview
bridge, so the view must declare each method it calls.

```ts
const imports = defineView({
  id: "imports",
  title: "Imports",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/imports.ts", import.meta.url),
    capabilities: ["files.upload"],
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
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";

export default defineExtensionView({
  async render({ host, mount }) {
    const files = createWebviewClient(host).files;
    const [selected] = await files.pick({ accept: ".csv,text/csv" });
    if (!selected) return;

    const uploaded = await files.upload({
      name: selected.name,
      data: await selected.arrayBuffer(),
      mimeType: selected.type || "text/csv",
    });

    mount.textContent = `Uploaded ${uploaded.name}.`;
  },
});
```

`files.list` and `files.delete` remain callable but are deprecated in 0.44. Use extension
commands and owned storage for durable file workflows.

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
await client.navigation.open({
  kind: "page",
  page: { kind: "page", id: "ticket" },
  resource: {
    type: "ticket",
    id: "PS-260",
    label: "Dashboard webview capabilities",
    metadata: { status: "in-review" },
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
  refreshOn: { client, events: ["pstdio.planner.statuses-changed"] },
});

const saveStatus = useCommandMutation({
  command: client.commands["ticket-status.update"],
  invalidate: [["ticket-statuses"]],
});
```

`refreshOn` subscribes to each event, refetches matching queries and refreshes after a host
reconnect. Events during a pending read queue one later read; simultaneous reset callbacks
share that refresh. Subscriptions stop on
unmount. Set `enabled: false` to disable both the query and its refresh subscriptions.

## Host context and capability errors

`defineExtensionView` types its render props as `WebviewHostProps` by default. Every host supplies `projectId`, `themePreference`,
`locale`, `resource`, `pageLocation`, `pageParams`, and `translations`. Context without a
project, resource or page keeps that field undefined. `pageParams` defaults to `{}` and
translations have empty bundles when the host supplies none. Custom props remain supported.
`lastCommand` is deprecated; use `client.events` or `refreshOn` for refreshes.

Capability failures are Errors with `code`, `message`, and optional `data`. Narrow them with
`isWebviewCapabilityError(error)` from `@pstdio/sdk/extensions`. This works across bundles.
A declaration denial uses `undeclared_webview_capability` and `data.capability`. Invalid
parameters use `invalid_params` and keep nested validation issues. Command rejections retain
their separate `CommandOutcomeError.outcome` contract.

Declare bare capability names. Versioned declarations such as `"clipboard.write@1"` remain
accepted but are deprecated through 0.44. Typed clients still require the declarations they use.
`client.placement.close()` needs `placement.close`; `client.notify.toast({ type, title?, message })`
needs `notification.show`. The old `{ level, title, message? }` toast shape is deprecated.

## Terminal sessions

Use the host terminal surface for new views. The old `terminal.session` capability and
`createTerminalSessionBridge` remain supported but are deprecated in 0.44.
See [terminal sessions](0022-terminal-sessions.md) for shell activity, ownership and cleanup.

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

Set `pstdio.projectFiles.tracked` in the package manifest to control the allocated `ctx.extensionFiles` repo mount. It is rooted at `.pstdio/extension-storage/<package-name>/.publishers/<publisher>/` from extension API 0.2, which ships in the release after 0.43.x. In 0.43.x it is rooted at `.pstdio/ext/<publisher>.<name>/`. Publishers with the same package name keep separate files and ignore rules. The host adds an ignore entry for that publisher on the first write unless `tracked` is true.

## Artifact mounts and storage

See [artifact mounts and storage](0021-artifact-mounts-and-storage.md) for records, assets,
allocated files, webview reads and watched mounts.

### Collection and file writes

These rules apply to 0.43.x and `main`:

- `ctx.storage.collection(name).list()` returns a plain array of items, `TItem[]`. It is not `{ items }` or `{ rows }`. Map the items to rows yourself in a table or board `query`.
- `get(id)` returns the item, or `undefined` when it does not exist.
- `put(id, value)` creates or replaces an item. Use it for new items.
- `update(id, value)` replaces only an existing item. It throws when the item does not exist, including when another writer deleted it, so a late edit cannot bring a deleted item back. Use it for edits instead of `get` followed by `put`.
- On an artifact mount or `ctx.extensionFiles`, `writeText(path, value)` creates or replaces a file. `updateText(path, value)` changes only an existing file. It fails when the file is missing and never recreates a file that was deleted during the write.

Save before you announce a change. In a command, validate the input, wait for the storage write to finish, then call `ctx.events.emit(eventRef, payload)`, then return the saved value. Do not emit when the write failed. Views that list the event in `refreshEvents` run their `query` again, and webviews that subscribe read again, so they must find the data already saved. The event payload is a signal, not the data.

### Webview reads

See [webview mount reads](0021-artifact-mounts-and-storage.md#webview-reads).

### Watched mounts

See [watched mounts](0021-artifact-mounts-and-storage.md#watched-mounts).

## Client events and workspace scope

`createWebviewClient` also exposes `page`, `files`, navigation, placement, notices and preferences. Subscribe through the events client and dispose subscriptions when the view unmounts. Pass `{ workspaceId }` when commands need a specific workspace; omitted commands use the project's default workspace. The client defaults to the host's calling extension ID; a type-only import does not change routing. See the [client contract](../../../packages/sdk/src/extensions/webview-client.ts) for signatures and options.

## Streamed commands

Declare the `commands.stream` webview capability to read a command that declares `stream: streamOf<TChunk>()`:

```ts
const controller = new AbortController();
const stream = client.streams["logs.tail"]({ source: "build" }, { signal: controller.signal });
for await (const line of stream) {
  appendLine(line);
}
const outcome = await stream.outcome;
if (outcome.ok) showSummary(outcome.value);
else showFailure(outcome);
```

`client.streams` contains only commands with a stream declaration. It accepts the same parameters as `client.commands`, followed by an optional `{ signal }`. Each stream has one consumer. `outcome` always resolves with the complete final outcome, including rejection and transport failure. The chunk iterator closes normally on each terminal path. Use `getCommandValue(outcome)` when a value or `CommandOutcomeError` is more useful. The old `.result` promise is deprecated and keeps its value-or-throw behavior through 0.44.

Call `stream.cancel()`, abort the signal, or break the loop to stop the command. Cancellation clears unread chunks, ends iteration and resolves an error outcome with `command_stream_cancelled`; it does not wait for a remote acknowledgement. Cancellation before start opens no subscription. Frame disconnect also cancels streams and plain command calls. Hidden mounted panels keep running. A lost connection resolves an error outcome with `command_stream_disconnected` and its original cause. It never retries the command.

HTTP SDK callers use `client.extensions.streamCommand(projectId, commandId, input?, options?)` with the same chunks, outcome and cancellation rules. The old HTTP `extensions.stream` event iterator stays callable and is deprecated.

The host allows 16 live streams per frame and 8 MiB of unread JSON per stream. Overflow ends the stream with `command_stream_overflow`. All command streams and session readers share one connection. Events remain invalidation signals; chunks go only to their caller.

The low-level `commands.stream` bridge accepts `start`, `cancel`, and `ack` operations. `createWebviewClient` handles IDs, consumed-byte acknowledgements, and scoped `data`/`end` events for you.

## Page params

Page params are on `main` (extension API 0.1.7 and later) and ship in the release after 0.43.x. `@pstdio/sdk` 0.43.1 and the 0.43.1 app do not have them.

A page can declare a `params` record. Each definition has a `type`: `string`, `number`, `boolean`, or `string[]`. It may have a matching `default`. String definitions may also restrict values with `values`.

Names match `^[a-z][a-z0-9-]*$`, contain at most 64 characters, and cannot use existing host URL selectors: `resource`, `section`, `document`, `line`, `column`, `endLine`, or `endColumn`. A page may declare 32 names. Its encoded param query is limited to 2,048 characters.

Every webview receives `pageLocation` and `pageParams` props. `pageLocation.params` contains overrides that differ from defaults. `pageParams` fills in declared defaults. Read the same store through `client.page.location()`, `client.page.params<T>()`, and `client.page.subscribe(listener)`. The render-context `page` helper is deprecated.

Declare `page.params.update` to call `client.page.updateParams({ range: "now-6h" })`. A `null` value resets that name to its default. The host replaces the current history entry and sends the location to every view. Only the extension that owns the active page can update it. Other callers fail with `page_params_not_owner`; calls without a page fail with `page_params_no_page`.

A page navigation target may carry `params`. It replaces all destination params and pushes history when the location or params change. Undeclared names, wrong types, disallowed string values, and oversized queries fail with `page_param_invalid`. The previous location, URL, history, and layout stay intact. Invalid URL values are ignored and use their defaults instead.

URLs use plain query keys. Lists use repeated keys in item order. Missing values use their defaults. Defaults and empty lists are omitted, so an empty list reads as its declared default. Params stay out of route identity, page state keys, layout caches, and breadcrumbs. Saved locations and contextual parents retain their own params.

Native query and file-load callbacks receive defaults through `renderer.pageParams` for placements owned by the active page. The host reruns these reads when params change. Shared shell and mode placements do not inherit page params.

## Webview preferences

Declare `preferences.get` and `preferences.set` to save small view choices:

```ts
await client.preferences.set("lastRange", "now-6h");
const range = await client.preferences.get("lastRange");
```

An undeclared name belongs to the calling extension. Other extensions have separate values under the same name. Dashboard webviews store these values on the server, so browser reloads and Desktop restarts keep them, and other clients read the same values. `set` returns only after storage succeeds.

The default scope is `user`, shared by clients of the runtime. `project` uses the active project when `scopeId` is omitted. `workspace` and `session` require `scopeId`. `extension` uses the calling extension's user scope. Scoped reads fall back to the user value. `default` is read only and has no value for an undeclared name. Writing it fails with `preference_scope_read_only`.

Each JSON value may contain 16 KiB. An extension may store 256 KiB across all scopes. Writes exceeding either limit fail with `preference_too_large` and preserve stored values. Removing an extension retains its preferences for a later reinstall.

`dashboard.themePreference` and `dashboard.locale` remain shared host names with their existing provider behavior. Access to names registered by another extension still works, but emits a deprecation warning. Use your own extension's preference names; cross-extension access is deprecated in 0.44 and will be removed in 0.45. Shared core preferences remain supported.

Agents use the same authenticated API:

- `GET /v1/projects/{projectId}/extensions/{instanceId}/preferences/{name}` reads `{ name, value? }`.
- `PUT` to the same path writes a JSON body `{ "value": ... }` and returns `{ name, value }`.
- Optional query keys are `scope` and `scopeId`.
- Global views use `/v1/extensions/installed/{installName}/preferences/{name}`. Project, workspace, and session scopes need an explicit `scopeId` on this path.

These routes store extension-owned values. Declared settings use the settings API. Theme and locale remain host appearance choices. Use `ctx.storage` for extension product data rather than view preferences.
