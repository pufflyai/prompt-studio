# Native chat views

The native `chat` view body renders the shared conversation and composer in the
workbench document. It loads no extension React code, webview or guest runtime.
Use a supporting published SDK and host before adopting it in a released extension.

```ts
import { defineView } from "@pstdio/sdk/extensions";

const conversation = defineView({
  id: "conversation",
  title: "Conversation",
  body: {
    kind: "chat",
    draftKey: "compose",
    initial: { messages: [], values: {} },
    query: async () => ({ messages: [] }),
    onAction: async (_ctx, { action }) => {
      // Bind actions to the existing public scoped services.
    },
  },
});
```

Reference `conversation.ref` from an ordinary page Main, slot or resource binding.
The [generic layout](0008-contextual-workbench-composition.md) owns selection and
page/panel conversion. `initial` is serializable metadata available on the first
render; neither query, draft hydration nor connection establishment gates the
composer. State is shared by project, view and resource. The resource ID overrides
the fallback `draftKey`. Actions receive the invoking placement's renderer context,
including page params, project, mode and resource, through ordinary scoped routing.

## Snapshot and stream handoff

`query` returns a `ChatRendererSnapshot`: canonical session messages, queue entries,
controls and values, streaming/read-only state, approvals, harness state, decisions
and resource actions. Optional fields update only that field. Clear nullable
approvals, decisions and draft tags with `null`; clear lists with empty arrays.

`stream` references an ordinary command with `stream: { kind: "stream" }`. Write
`ChatRendererEvent` chunks through `ctx.stream.write`. Each connection has increasing
`revision` values; older or repeated revisions are ignored. Send a full
`snapshot.messages` before incremental message patches, including on reconnect.
Patches add/replace/remove a whole canonical message at `/messages/<index>`, or
replace the array at `/messages`. Reduce nested content patches before emitting.
Live fields take precedence over a delayed query; a notice-only event does not
displace history. Reconnect keeps displayed state. Connection errors offer Retry.
Refresh events follow the normal native renderer path.

Use `ctx.sessions.getConversation`, `getConversationSources`, `stream`,
`getQueuedMessages` and `getHarnessCommands`; do not duplicate transcripts or
execution. A watch command should use `ctx.sessions.retainResources(sessionId)`
and close its hold in `finally`. The host aborts reads and watches when the last
view releases them or the extension unregisters. Cancellation releases holds and
subscriptions; it must never invoke `ctx.sessions.stop`.

## Actions and durable drafts

`onAction` receives `ChatRendererAction` and `draftKey`. Bind submission, stop,
questions, approvals, harness controls, queues, attachments and navigation to their
existing public services. Its result can update a snapshot, return an uploaded
attachment, or replace the draft. Queue actions carry the selected position and
revision: pass those through to the existing queue APIs. Upload data is base64;
use the public attachment service. Removing a chip removes a reference, not a
possibly shared file. The host deduplicates pending submissions across placements.
Service permissions and queue revision checks remain authoritative.

`loadDraft` and `saveDraft` use extension-owned project storage. Persist the complete
`ChatDraft`, including `recovered`. Saves wait for hydration and follow edit order.
When typing races an older saved draft, both texts and attachment lists survive.
Restore saved draft swaps them without discarding current work. Failed hydration
prevents overwriting unread storage; save errors stay visible. Saves may finish
after the view closes. Project and draft identity must also scope storage keys.

Mark foreign-device history `readOnly`: execution controls are disabled, and
history and resource navigation remain usable. Existing services enforce ownership.
`resolveLink` confirms resource candidates and returns a label, icon and href;
`resolveImage` resolves image sources through scoped file APIs. Opening links
dispatches `openLink`; resource buttons dispatch `openResource`. Use public
navigation and preserve standard unavailable-target feedback.

## Delivery order

The PS-60 host prerequisite ships before separate Sessions extension adoption.
Dashboard Sessions and their draft keys remain active until installed parity.
Adoption owns their supported transition, default installation, navigation refs
and consumer updates, using published supporting packages. Use a published SDK
containing this contract and a compatible host; see [API versioning](0014-api-versioning.md).
The independent fixture is `packages/e2e/src/fixtures/native-chat/extension.ts`.
