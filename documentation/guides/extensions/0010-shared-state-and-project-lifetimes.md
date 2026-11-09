# Share state and retain project data

These APIs are on `main` for extension API **0.4.0**, after 0.46. Publish the matching host, SDK and UI before releasing an extension that uses them. A local packed-package test proves the candidate contract; it does not make the dependency available to installed users.

## Choose the owner

| State | Owner |
| --- | --- |
| A finite server result | `client.queries` or a runtime-owned `createScopedQueryClient` |
| A shared editable document, gesture or save queue | Public editing session and the extension's domain commands |
| Synced rows | Existing host collections and storage; query results are projections |
| Selected UI values | A Zustand store scoped to the view, project or runtime that owns them |
| Focus, pointer capture and DOM geometry | The mounted view and its existing interaction controller |
| Transcript, terminal, text/presence protocol | Its existing stream or editing controller |

A query cache does not become a second editable document. A mounted view observes its owner and releases optional work when hidden. Accepted saves retain their original project and executor until they settle.

## Read finite data

Create a typed client with `createWebviewClient<typeof commands>(host)`. Its `queries` property shares one root for that guest host. Do not create a new QueryClient or clear the root whenever the selected project changes.

```tsx
import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useWebviewQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import type { commands } from "./commands";
import { itemChanged } from "./events";

function Item({ host, id }: { host: GuestHost; id: string }) {
  const client = createWebviewClient<typeof commands>(host);
  const active = useWebviewVisibility();
  const result = useWebviewQuery(client.queries, {
    id: "item",
    resourceKey: id,
    params: { id },
    events: [itemChanged],
    dependency: { resourceId: id },
    read: () => client.commands.read({ id }),
  }, active);
  // Render result.data, result.loading, result.fetching and result.error.
  // result.refresh() explicitly retries or marks this dependency stale.
  return null;
}
```

`commands.read` above is the author's own command. Return `null`, `[]` or another explicit empty value when nothing exists. `undefined` is not a successful query value. A loaded empty result remains loaded during refresh. A refresh error keeps accepted data; an initial error has no accepted data. Provide a visible Retry action instead of starting a retry timer.

The key includes runtime, account ID, account origin, project, extension, query ID, resource key and parameters. Put every input that changes the result in the descriptor. Use stable serializable parameters. Do not place a callback, DOM node or mutable draft in a query key.

`useWebviewQuery` follows project/account props supplied by the host. `useScopedQuery` observes an already chosen query; callers choosing that query from props must also follow those props. `useWebviewScope` supplies a selected identity for non-query operations. Theme or sizing changes do not select a new data owner.

The React entry has optional peer dependencies on **both** `react` and `@tanstack/react-query`. Declare both in an extension importing that entry, including when using the scoped hooks. Framework-neutral code can use `createWebviewClient`, `query.subscribe`, `getSnapshot` and `read` without React. The legacy `useCommandQuery` remains available with its existing QueryClientProvider contract.

## Declare changes once

After a successful write, emit the declared event with its known public scope:

```ts
await ctx.events.emit(itemChanged, {}, {
  refresh: {
    resourceIds: [id],
    changedFields: ["title"],
    membership: false,
  },
});
```

The host binds the emitting project and extension. `QueryChangeEnvelope` carries invalidation metadata, never document data or event payloads. It supports resource keys/IDs, changed fields, list membership and at most 128 opaque `recordIds`. Obtain a record identity with `ctx.storage.records.id(key)`; it is not a public resource ID. Use list membership for inserts, removals and edits to filter/sort fields. Unknown scope is conservative: omit information that the producer cannot establish.

The root routes events to matching dependencies, including retained inactive queries. Do not also attach a per-component listener that calls `refresh` for the same event. This duplicates ownership and work. Host reset/reconnect hints use the same dependency matching. A transport reconnection is not a reason to throw away all project caches.

Host tabs include the requested locale and fallback hierarchy in their query identity.
They depend on `viewDataEvents.extensionCatalogChanged` and
`viewDataEvents.extensionTranslationsChanged` as well as their declared events.
The latter identifies the project and extension whose accepted bundles changed,
including removed translations. Unchanged bundles on project return leave warm
results valid; translation freshness does not reset conversation streams or other projects.

A descriptor's optional `subscribe(invalidate)` covers a custom source. The query installs it before its first read, shares it among observers and closes it after the last observer. That detached source has no retained cursor: the next observation performs one catch-up while retaining accepted content. For a clean warm return without that catch-up, route cheap scoped hints through the root, or use an existing revision/cursor that proves freshness.

## Keep project return warm

Ordinary A → B → A selection releases A's optional observations and retains its accepted values. The SDK root defaults to **128 inactive query owners**. The dashboard explicitly retains **512** because its shared root includes native renderers, catalogs and editing sources across ten projects. Active observations and entered reads are protected. Access touches normal least-recently-used retention order, including unread descriptors. After an unobserved read settles, the inactive bound applies again. Eviction removes the owner and makes the next use a real initial read. Do not keep using a disposed handle; choose the current owner again from its descriptor. Account/origin/runtime retirement purges private accepted data before notifying observers.

In a browser, dispose a guest's root when the view is actually destroyed, not when its project is merely hidden. For independently mounted iframes needing one document authority, use host-owned editing sessions rather than separate iframe query caches. A query root does not share JavaScript memory across iframes or windows.

Invalidations coalesce into the current read and one latest follow-up. Old completions cannot overwrite a newer accepted value. Pass cancellation to I/O that supports it. Cancellation fences publication but does not mean an uncooperative child stopped: its admission remains occupied until the actual work settles. Read cancellation never cancels an accepted domain write.

Closing the last presentation stops optional refresh work and retains accepted data.
Use `query.refreshObserved()` when a presentation refresh must await its current
observed read. It invalidates inactive data without reading it; active work remains
optional and cancels when its final observer leaves. An independent required reader
still retains the shared operation. Awaiting refresh alone does not keep a view alive.
An explicit `read()` caller owns its coalesced read until settlement, even when a
presentation leaves. Explicit cancellation and authority retirement still cancel
that work. A custom source detached without a retained cursor reconciles on the next
observation or explicit read; repeated unobserved reads cannot assume that source
stayed current.

Never acquire subscriptions or retention leases in a React render. Abandoned Suspense renders do not have a cleanup phase. Acquire them at commit and keep the committed placement identity stable when a cache handle is replaced.

## Share editing across views

Use `client.editing.openCommand<State>({ key, read, command, dependsOn })` when commands own validation, undo or atomic storage transactions. Declare the public `editing.session` and command execution capabilities. The host owns one session per runtime/account/project/extension/document key across its views. Separate windows/hosts converge through the domain's normal storage and project synchronization, not through an in-memory singleton.

The first read returns `{ value, sources }`. Each source has an `id`, a read command, declared events and optional storage/resource dependency. Give a small presentation source its own record and reader so changing the tool does not reread the document.

The execute command and every source-read command must return `WebviewEditingCommandResult`: either `{ value }`, replacing the complete accepted object, or `{ changes }`, applying field patches to that object. A void result or an ordinary unwrapped command value is invalid. `sourceIds` optionally names the sources whose freshness the response covers. Without it, a source read covers itself; an execute result with `value` covers all sources; execute patches cover none. Name only sources whose current invalidations the returned data includes. Accepted patches can update the shared value while another stale source still needs its own reconciliation.

For example, a command that has persisted and acknowledged a tool change can return a small presentation patch:

```ts
import type { WebviewEditingCommandResult } from "@pstdio/sdk/extensions";

const acceptedTool = {
  changes: [{ path: ["tool"], value: "brush" }],
  sourceIds: ["presentation"],
} satisfies WebviewEditingCommandResult;
```

The initial read declares a source with ID `presentation` and its small read command. That source-read command returns the same result shape; a full reload is not needed to acknowledge the presentation record.

- `preview(changes)` publishes a tentative view value without a durable write. Optional previews have one actual publication and one latest replacement.
- `execute(params, { changes, channel })` admits one completed domain operation, with optional optimistic changes and `"document"` or `"presentation"` acknowledgement channel.
- `cancel()` removes the caller's unfinished preview. It does not undo another accepted operation.
- `save()` waits for or retries failed accepted operations. Commands receive stable operation IDs; implement idempotent retries using storage outcomes.
- `close()` releases the view. Accepted commands retain their captured authority and drain before that workbench retires.

Read `hasDrafts`, `pendingCommands`, acknowledgement revisions, channel/source errors and terminal `retired` state. Do not label a preview or failed operation saved. Never prune a required command merely because a later snapshot looks like its optimistic result. Keep undo in the domain command authority.

Marmalade is the maintained example in `extensions/extension-lab/src/apps/marmalade/`. Its presentation identity is **project + extension + document**. Tool, selection, expansion, zoom and pan are shared between authorized participants and persist across reopen/reload/restart. Focus and unfinished pointer mechanics remain local. Pure presentation actions write only the small presentation record; document edits atomically save document, history and affected selection/expansion. Undo restores selection/expansion alongside document edits while keeping tool and viewport. The legacy record is imported once into versioned records; new code does not keep writing both formats.

## Observe command-side metadata

`ctx.storage.observe(changed, { recordIds?, signal? })` observes committed records in the caller's project and extension, including local signed-out writes and received project-sync changes. Subscribe before reading and close the handle in `finally`; the command invocation also retires it. A hint contains opaque identities, not values. Scope narrowing follows `storage.scope(...)` automatically.

`ctx.sessions.observeMetadata(sessionId, changed, { signal? })` returns a shared handle for exact session/link, workspace/diff, harness command and execution-availability changes. The callback names the affected group: `session`, `workspace`, `harness` or `execution`. Read only that group. Transcript, queue and approval updates remain on `ctx.sessions.stream` and keep their own revision rules.

Harnesses can supply optional `watchCommandState`. Install it before reading and close it with the last observer. Recovery polling is appropriate only for an evidenced provider coverage gap; bound its payload, cadence and lifetime and record its removal condition. A consumer should replace an unconditional full snapshot timer only after its exact observation coverage is complete. See [temporary metadata recovery](../../adrs/0141-temporary-session-metadata-recovery.md).

## Reuse the contract fixtures

`createQueryLifecycleFixture` from `@pstdio/sdk/testing` provides a finite source with real subscribe/read separation, read counts, observed signals and a held child. Connect its `descriptor` to a scoped query or a native adapter. `holdNext()` exposes `entered` and `release()`; the held child deliberately remains entered after abort. Always release/close it during cleanup.

Use it to check duplicate readers, loaded-empty values, a 100-hint burst during a held read, stale completion, final release and authority retirement. Project return should separately cover a root-routed fresh source and a detached custom source requiring catch-up. The maintained SDK and native renderer tests run those actual owners. Public editing and two/ten-project fixtures under `packages/e2e/src/scripts/marmalade-*` cover five-view shared document ownership; packaged sync fixtures add independent authenticated hosts.

Record topology and actual counts in qualification evidence. Two iframes are not two users, a page reload is not an app restart, and JavaScript heap is not process physical footprint.

*Updated at: 2026-11-09*
