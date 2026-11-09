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
    onAction: async () => {
      throw new Error("Connect conversation actions to your tool before use.");
    },
  },
});
```

Reference `conversation.ref` from an ordinary page Main, slot or resource binding.
The [generic layout](0008-contextual-workbench-composition.md) owns selection and
page/panel conversion. Visible native conversations request composer focus on opening;
hidden retained presentations do not request focus. `initial` is serializable metadata available on the first
render; neither query, draft hydration nor connection establishment gates the
text composer. Control fields stay read-only until the initial query and saved draft
settle, so automatic field defaults cannot replace saved selections during hydration.
Stream notices do not finish this initialization. Early text edits preserve saved
control settings; only locally edited control keys take precedence over hydration. Explicit draft
restoration selects all restored settings, including those equal to current defaults. State is shared by project, view and resource. The resource ID overrides
the fallback `draftKey`. Actions receive the invoking placement's renderer context,
including page params, project, mode and resource, through ordinary scoped routing.
Reads, draft persistence and new watches use the latest placement context.
Placements sharing a resource must refer to the same conversation. Host adapters can
normalize resource defaults with `resolveChatResource` before native owner selection.
Command bindings keep the invoking placement resource so captured viewer/from checks
still compare that exact source. The dashboard uses its existing canonical resource policy so
legacy core URLs and qualified provider targets share one owner; explicit foreign
owner/project scopes remain distinct. Other hosts retain their supplied identities.

## Workspace contribution

An optional snapshot `workspace` binding places workspace/device identity,
setup status, diff counts and opening in the shared workspace hub. It references provider-owned
selection controls by `controlId` and optional `deviceControlId`; those controls are consumed
there once instead of appearing among generic composer fields. Existing conversations can keep
read-only selectors visible, including their owning device. Use `null` to remove the binding. Existing `resources` actions remain available independently.

```ts
import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";

const workspace: ChatRendererSnapshot["workspace"] = {
  controlId: "workspace",
  deviceControlId: "device",
  openResourceId: "workspace-id",
  status: "ready", additions: 12, deletions: 3,
};
```

Workspace selections are existing workspace string IDs. The native composer reuses the shared
workspace menu; workspace creation stays in the existing global workspace commands/forms.
Sessions supplies `openResourceId` only for an existing session with an available selected workspace;
it omits the binding action for new drafts, including auto-selected defaults. The generic host
validates the visible matching option and retains owner-provided navigation in read-only chats.
Saved sessions display the selected workspace as the Open button. Device selection appears only
with multiple devices; a saved session's owning device remains a readable, read-only identity.
These controls use the native owner's existing draft values and per-control action clocks.

Sessions uses `messages-circle` for extension identity and the collection page/navigation, and
`message-circle` for each conversation/draft/resource/tab and the Dashboard bubble. Session tree
status colors preserve the host mapping: completed success, failed error, cancelled/disconnected
warning, queued info and every other status muted.

Harness choices use agent metadata's exact owning `extensionId` and installed manifest `icon`.
The host resolves package SVG assets with the same bounded asset reader used by Extensions;
the native picker uses that icon for each harness and its selected parent row. An absent or
unreadable icon falls back without removing the harness. No ID/name inference or marketplace
icon lookup is involved. Attach files is an icon-only paperclip action with an accessible label and
tooltip; upload and attachment ownership are unchanged.

## Snapshot and stream handoff

`query` returns a `ChatRendererSnapshot`: canonical session messages, queue entries,
controls and values, streaming/read-only state, approvals, harness state, decisions
and resource actions. Optional fields update only that field. Clear nullable
approvals, decisions and input tags with `null`; clear lists with empty arrays.
`draftTag` describes the current unsent input; `sentTag` independently describes a
submitted native operation. Both use `label`, `description`, `clearActionId` and an
optional `closeLabel`. Closing a submitted reference dispatches its provider action;
it must not stop execution or discard recoverable input.

`stream` references an ordinary command with `stream: { kind: "stream" }`. Write
`ChatRendererEvent` chunks through `ctx.stream.write`. Each connection has increasing
`revision` values; older or repeated revisions are ignored. Send a full
`snapshot.messages` before incremental message patches, including on reconnect.
Patches add/replace/remove a whole canonical message at `/messages/<index>`, or
replace the array at `/messages`. Reduce nested content patches before emitting.
Use `chatRendererStreamFrames(event)` from `@pstdio/sdk/extensions` when writing
events, including snapshots, patches and draft recovery. Await each frame in order
and finish one event before writing the next. Small events stay unchanged; large
events become bounded `ChatRendererStreamEvent` fragments within the existing
64 KiB command-stream limit. The native owner validates and reconstructs one event
before publishing it atomically, retaining visible history and draft state while
fragments arrive. This also supports a single large message or tool result without
truncating it. No query refresh, transcript polling or execution service is added.
Malformed/interleaved or naturally incomplete events report a stream error;
disposal/reconnect discards unfinished fragments without stopping work.
Live fields take precedence over a delayed query; a notice-only event does not
displace history. Reconnect keeps displayed state. Connection errors offer Retry.
Refresh events follow the normal native renderer path. A versioned `recoverDraft`
event restores work after an accepted asynchronous native operation fails. The
host restores an unchanged cleared composer, or retains the failed work under
`recovered` when newer text, files or settings exist; persistence follows either
path, including after the view closes.

Use `ctx.sessions.getConversation`, `getConversationSources`, `stream`,
`getQueuedMessages` and `getHarnessCommands`; do not duplicate transcripts or
execution. Session browsing can use `ctx.sessions.query({ search, limit, cursor })`
for a case-insensitive literal title search applied before pagination, including
readable remote history. A watch command should use `ctx.sessions.retainResources(sessionId)`
and close its hold in `finally`. The host aborts reads and watches when the last
view releases them or the extension unregisters. Cancellation releases holds and
subscriptions; it must never invoke `ctx.sessions.stop`.

Declare all pending native confirmations in `decisions`, with a stable ID for each
revision. The native view owner displays the first available decision and retains
successful Skip, Cancel and approval dismissals across query/stream refreshes. A
revised ID becomes eligible again; other simultaneous decisions remain available.
An action result's explicit `decision` reopens only that revision. The singular
`decision` field remains supported for providers with one current decision.
Dismissals belong to the native owner, never durable draft values; reload or
extension unregister creates a fresh owner. Providers must omit `decision` from
routine responses and send their current catalog through `decisions`.

## Actions and durable drafts

`onAction` receives `ChatRendererAction` and `draftKey`. Bind submission, stop,
questions, approvals, harness controls, queues, attachments and navigation to their
existing public services. Its result can update a snapshot, return an uploaded
attachment, or replace the draft. Queue actions carry the selected position and
revision: pass those through to the existing queue APIs. Upload data is base64;
use the public attachment service. Removing a chip removes a reference, not a
possibly shared file. The host deduplicates pending submissions across placements.
Harness command, confirmation and decision actions carry the visible control
`values`; decisions can carry their displayed `modeSnapshot` for stale-decision
validation. Read fresh service state before executing a captured decision.
Service permissions and queue revision checks remain authoritative. Question replies
send no draft attachments and leave the unsent message and its files intact.

An action result's `snapshot.values` is a partial control update, including provider
intent metadata. Each key applies only if that control has not changed since the
action began. Unrelated live/query controls do not suppress it; newer values for
the same control win. Accepted action values are saved without requiring another
keystroke, including after unmount. Query/stream values supply defaults for controls
not locally owned. Replacing the complete draft values (including restoring a
recovered draft) releases ownership of removed keys, allowing current defaults to
fill those keys again.

`loadDraft` and `saveDraft` use extension-owned project storage. Persist the complete
`ChatDraft`, including `recovered`. Saves wait for hydration and follow edit order.
When typing races an older saved draft, both texts and attachment lists survive.
Restore saved draft swaps them without discarding current work. Failed hydration
prevents overwriting unread storage; save errors stay visible. Saves may finish
after the view closes. Project and draft identity must also scope storage keys.

The native host synchronously stages unacknowledged edits in browser storage,
scoped by project, view and canonical resource/draft identity. A document reload
can restore text, uploaded-file references and control values before provider
reads finish. The provider remains the durable draft owner: matching save
acknowledgements clear staged edits, while an older acknowledgement cannot clear
newer typing. Recovery merges a different provider draft using the existing
`recovered` behavior. This journal contains unsent drafts, not transcripts or
execution state; closing a view does not discard an unacknowledged edit.

Backend providers can apply canonical `/messages` patches with
`applySessionMessagePatch` from `@pstdio/sdk/extensions`, without installing the UI
package. The existing `@pstdio/ui/chat-ui` export delegates to that same reducer.
It preserves presentation identity across prompt ID confirmation and reordering,
including explicit provider animation keys. It does not create a second transcript
or validate incoming service payloads.

When an extension opens a Core session, qualify its resource as
`{ type: "session", extensionId: "pstdio", projectId: ctx.projectId, id }`, including
when using the deprecated Core panel placement. The bridge qualifies an authored
bare `{ type: "session", id }` to the authoring extension; it does not imply Core
ownership. Native Sessions validates that identity. Existing consumers that relied
on the legacy viewer ignoring owner identity must migrate their references.

Use `ctx.sessions.getExecutionState` for availability: local sessions work while
signed out, online remote owners retain follow-up, question, approval, queue and
stop controls through the host relay, and unavailable remote history is read only.
Do not infer ownership by comparing an absent account device ID. Queue snapshots
may independently be read only without disabling question replies or other controls;
set `queueReadOnly: true` and offer a refresh operation while recovering them.
During a running response, the composer keeps typed text and Stop available instead
of offering another queue submission; pending question and decision replies stay usable.
Remote queues support editing, reordering, combining and removal, but exclude live
steering: display “Live steering is unavailable on another device.”
Set `queueSteeringUnavailableReason` for a conversation that cannot accept live
steering; native queue drag presentation hides Send now. Emit explicit `null` when
that capability returns, so merged snapshots clear the previous reason. Individual
`queuedFollowUps[].steeringUnavailableReason` values still disable a particular
request without hiding the conversation's steering destination.
`ctx.sessions.create({ deviceId, ... })` targets an account device; omission targets
this host. Attachment forwarding, project checks and permissions stay in core.
Readable personal-history sessions retain their linked `workspaceId` in both
`get` and `getConversation`, even when this host has no local execution link. Use
that public context for workspace navigation and scoped links; it grants no local
execution ownership or cross-project access.
A logical default workspace can have no local folder. Harnesses with optional cwd
can start there; harnesses requiring files receive the existing folder setup error.
Use project `ctx.storage.files` and a small record pointer for durable draft bodies
when a project has no folder.
`resolveLink` confirms resource candidates and returns a label, icon and href;
`resolveImage` resolves image sources through scoped file APIs. Opening links
dispatches `openLink`; resource buttons dispatch `openResource`. Use public
navigation and preserve standard unavailable-target feedback.

## Trusted host features

Native chat uses the compact model menu and inline harness parameters from
`@pstdio/ui/param-editor` (`HarnessModelMenu` and `HarnessParamInlineControls`).
Command forms keep the labeled `HarnessModelPicker` and `HarnessParamEditor`.
Both presentations use the same control values, identity locks and settings/reset semantics.

Set `nativeHarnessAccount: { controlId: "your-harness-control" }` to use native `/login` and `/logout` handling and
the host account progress, browser and secret-input UI. Authentication replies use
the dedicated authentication channel, never chat actions, command history or
transcripts. Normal submission waits for harness/account discovery and is disabled when
signed out, missing a harness/model, or authenticating. Login/setup remains
available. Discovery stays quiet and keeps the normal empty content; readiness can block submission
without replacing it. Sign-in, missing-harness setup, authentication progress and retryable
authentication errors replace empty content, or appear beside existing history without hiding it.
For an online remote owner, set `remote: true` in this binding and
use `getExecutionState` for device availability instead of local harness discovery. Omit
this opt-in for a provider with its own command semantics.

Set `nativeLinks: true` and supply `workspaceId` for the host workspace link and
image resolver. It preserves scoped relative/absolute paths, line positions,
resource-owned paths, canonical project links, web icons and safe external tabs.
Native file parts reuse authenticated blob URLs for the current project’s session
attachments and the provider’s own stored files; arbitrary API paths are excluded.
Draft and queued-edit image attachments use the same scoped authentication adapter
for thumbnails and preview dialogs. Selecting an image opens its preview; the
separate Remove control only removes that draft reference. Resolved blob URLs are
presentation values, never replacements for the provider's persisted attachment URLs.
Declared `resolveLink` and `resolveImage` callbacks keep priority, with host
resolution as a fallback. With this opt-in, generic app-page URLs defer to the
host's destination validation; an unavailable page remains an actionable error,
not an unvalidated browser navigation. External web links use the host's native icon, fallback globe and safe new-tab presentation.
Without opt-in the provider's handlers remain unchanged.

A harness control accepts `harnessId: ""` while unselected. Execution still
requires a real installed harness. Set `lockIdentity: true` on a saved-session
control to lock only the harness; models and parameters remain editable. Providers populate `ChatQueuedRequest.values` with the saved request settings
under their own control IDs. The host overlays those values on the draft for
queue editing and create-as-new; the trusted account binding also uses the visible
request settings rather than the unchanged base draft. `model` and `params` are display metadata.
Saved models no longer advertised by discovery remain unchanged. `preserveSettings: true` requests
that behavior outside queue editing. Explicit parameter resets send resolved
default values when the control explicitly sets `settingsMode: "resolved"`, so a
persisted nondefault value is actually replaced. The default `"overrides"` mode
keeps generic settings forms sparse, including removing an override on reset.

Set `snapshot.fork` to expose per-message fork actions, with a nullable
`disabledReason`. Local saved-session reply controls call `ctx.sessions.fork(id, messageId)`
without a preemptive native harness capability gate, matching Main's message action.
Drafts and foreign-device sessions omit this action. Completed earlier replies remain available
while later work runs. The shared native UI hides the current streaming reply's
fork control; the service authoritatively rejects that unfinished reply. Omit the
scope from `ctx.sessions.getForkState` (or use `"conversation"`) for a whole-conversation copy, which retains its
idle/queue guards. Both paths preserve independent transcript identity.
Queue steering must pass the `activeRunStartedAt` captured with the selected
request along with its revision, rather than reading a newer run when clicked.

The transitional view option `legacySessionDraft: true` transfers one legacy
Sessions browser draft for the same project and draft identity. It requires
`loadDraft` and `saveDraft`: the host saves both bodies (using `recovered` when
necessary) before acknowledging the unchanged legacy text/files. A failed save
leaves the old keys intact. It exposes no generic browser-storage capability.

## Delivery order

The PS-60 host prerequisite ships before separate Sessions extension adoption.
Dashboard Sessions and their draft keys remain active until installed parity.
Adoption owns their supported transition, default installation, navigation refs
and consumer updates, using published supporting packages. Use a published SDK
containing this contract and a compatible host; see [API versioning](0014-api-versioning.md).
The independent fixture is `packages/e2e/src/fixtures/native-chat/extension.ts`.

Native conversation owners survive unrelated tool installation or metadata refresh in the same project. The host retains an owner only while its extension and chat view declarations are unchanged. Changing or removing that declaration, switching projects, or disposing the host releases its subscriptions; re-enabling creates a new owner and loads the durable draft. This preserves edits made before asynchronous draft hydration finishes.


An ordinary message handoff has transient presentation owned by the native chat
resource, including its submitted files. It survives page/Side remounts while the
action is pending, without adding rows to canonical transcript indexes. A matching
new canonical echo replaces it once. Acceptance releases the request lock while
accepted pending rows remain until their separate echoes. Consecutive sends keep
separate identities even for identical text and files. An action result with an explicit
`sentTag` (including null), or a terminal message snapshot, ends a no-message
operation without waiting for a transcript echo. Rejection restores the submitted draft or retains it beside newer
unsent work. Questions keep their separate draft semantics, and a streaming
conversation's queued follow-up remains queue-owned.

When a first submit replaces its invoking draft viewer with a newly created
resource, the host transfers only the transient submitted receipt and presentation
identity after the ordinary viewer guards authorize the replacement. The new
resource owns its query, stream and durable draft. The source remains empty and
reusable; a stale navigation result or an unrelated explicit switch cannot carry
that submitted prompt into another conversation. Harness confirmation can replace canonical
message IDs while retaining the same displayed row; unrelated explicit provider
animation identities keep their existing meaning.


A snapshot operation with `refresh: true` reconnects the native owner's existing
query/watch, preserving its draft. It does not dispatch `onAction` or run a provider
command. This explicit refresh remains usable in a read-only conversation (for
example Check connection for offline history). Ordinary operations, submission
and execution controls retain their read-only guards; `disabled` still disables
a refresh button.


The implementation-free `sessionBrowser.commands.open` and `.create` references
accept an optional `panel` placement with `side: true`. A host compatibility bridge
can select the existing Side placement of the active mode without moving Main.
The provider validates the declared placement through ordinary navigation ownership.

Resource removal commands use their existing `description` as confirmation details,
name the selected resource, and keep failed saves in the confirmation dialog for retry.
The button uses the command title. Preview rollback and canonical write serialization
remain owned by the workbench.


### Pending queued input

The native owner retains an ordinary submitted input while its action is pending, including a sending queue row when the conversation is running. This presentation stays outside canonical transcript and queue indexes, survives placement changes, and hands off once to the matching saved request or canonical user message. Question replies do not create ordinary pending input or consume the message draft.

A rejected queued input stays visible as unsent work. Dismiss restores its text, files and control settings while retaining newer work as a saved recovery. The host persists this recovery through the provider's existing `saveDraft` binding, so reloading can recover unsent work even after transient presentation has gone. No extra queue or execution service is needed.

Canonical session link resolution can call `sessionBrowser.commands.resolve` with
`{ resources: ResourceRef[] }`. The provider returns readable, unarchived
`ResourceResolution[]` with its qualified page target while keeping core `pstdio`
session identity. Treat a missing provider or an omitted resource as unavailable.

The native renderer bounds chat to its placement and owns transcript scrolling. Long history is virtualized inside that viewport; it does not enlarge the outer workbench region.

The native owner includes accepted input in prompt recall while its queue receipt
awaits canonical history. This projection uses the same transient submission
identities and order; it does not insert queue rows into the transcript or its
patch indexes. `ChatPanel.historyMessages` supplies this recall-only projection;
ordinary callers continue to recall from `messages` by default.

Draft hydration consumes the journal captured when its owner opens. Edits staged
by that same owner while provider storage loads already belong to the live draft;
they are not replayed as saved control overrides over a newer query result.

*Updated at: 2026-11-07*
