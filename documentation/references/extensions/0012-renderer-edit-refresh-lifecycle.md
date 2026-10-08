# Renderer edit and refresh

This page explains how native file editors load, save, and refresh content, and how native views cancel and refresh their reads.

Editable native file renderers have one owner for loaded content, the current draft, one active save, errors, and external invalidation. Opening or saving an editor does not remount it, lose the selection, or repeat unchanged saves.

## Guarantees

- Opening unchanged content performs no save.
- Editing keeps focus and selection before, during, and after save.
- A save does not reload its own editor instance.
- Clean editors reload real external changes.
- Dirty editors are never overwritten by refresh events or late load results.
- Refresh work is scoped to one resource when the event provides that identity.
- Load and save errors remain recoverable.

## Concepts

| Term | Meaning |
| --- | --- |
| Baseline | Last canonical content accepted from load or a successful save. |
| Draft | Current editor content when it differs from the baseline. |
| Active save | One request with a captured value and operation identity. |
| Self invalidation | Refresh caused by the current renderer instance's save operation. |
| External invalidation | Refresh caused by another operation or renderer instance. |
| Revision | Optional ordered backing-store revision. |

## Ownership

The file renderer edit controller owns the baseline, draft, timer, active save, save error, and deferred invalidation for one renderer and resource binding. The React view renders that state and recoverable error actions. Extension commands, resource records, and editor components do not duplicate it.

The binding uses:

- the file renderer contribution id;
- the panel `instanceId`;
- the resource type, ID, and document-selection metadata in the renderer load key.

## Loading

1. The renderer stores canonical loaded text before mounting an editable editor.
2. An editor callback equal to the baseline is ignored.
3. A clean unchanged reload keeps the current editor revision and React key.
4. A clean changed reload increments the editor revision once.
5. A load that settles after a local edit is rejected by the controller and cannot replace the draft.
6. A failed reload keeps the current content visible and shows Retry. An initial load failure shows the same recoverable action without an editor.

## Editing and Saving

1. A real edit marks the binding dirty and resets the 600 ms debounce.
2. Reverting to the baseline cancels a pending save.
3. Only one save runs for a binding at a time.
4. A draft made during a save remains dirty and is saved after the active request settles.
5. The baseline advances only after the matching operation succeeds.
6. A failed save keeps the draft dirty and shows Retry. It does not retry on a timer.
7. Visibility and unmount flushes start a save for a known pending draft. They do not clear ownership before the request settles.

## Refresh Envelope

The in-process event feed and file renderer registry preserve this optional envelope:

~~~ts
interface RendererRefreshEvent {
  id: string;
  resourceKey?: string;
  origin?: {
    rendererId: string;
    instanceId: string;
    operationId: string;
  };
  revision?: string;
}
~~~

Generic extension events remain valid with only `id`.

Each file save receives a host operation origin. The file renderer adapter places the origin and resource identity key in command request metadata. They are not added to extension params or extension-owned event payloads. After the command returns, the dashboard attaches that host context to each published refresh event. A save result may return an optional revision. Use the SDK's `resourceKey` to compare identities; labels and metadata do not change the key.

## Refresh Classification

- An event naming another resource is ignored.
- An event matching the active or recently completed save operation is self invalidation. It never loads.
- A clean external event loads once.
- Duplicate events with the same revision do not load twice.
- A dirty, saving, or save-error binding defers and coalesces external events.
- After save, a deferred revision loads only when it is newer than the save result revision.
- Without revisions, a deferred generic external event performs one broader reload after local save state settles.
- A generic event cannot detect every concurrent write. It still never overwrites a known local draft.

Revisions are compared as ordered strings. Planner, for example, uses the ISO timestamp from the ticket or file `updatedAt` value.

## Focus and Selection

Debounce, save completion, self invalidation, and unchanged clean reloads keep the editor key stable. The renderer does not force focus after navigation or after a real external document change.

## Errors

| Error | Behavior |
| --- | --- |
| Load failed before content exists | Show the error and Retry. |
| Reload failed after content exists | Keep content visible and show an inline Retry notice. |
| Save failed | Keep the draft dirty, stop automatic retries, and show Retry. |

## Limits

- The lifecycle does not merge concurrent edits.
- It does not add revisions to stores that do not already have them.
- It does not provide an offline write queue.
- A browser cannot wait for an asynchronous save during forced page termination. The renderer still starts the flush and retains ownership for every lifecycle where the page remains active.

## Read ownership and cancellation

The workbench owns read slots by stable placement, resource, and read lane. Each slot permits one active load and one latest pending refresh. Repeated events coalesce. Replacing a query, retrying, or unmounting aborts the active signal. The slot remains occupied until the actual load and its children settle, including across remounts and reopening the same placement.

Reads have no time limit. A slow read keeps its loading state until it settles or is aborted. Workbench disposal aborts all reads and drains them.

Kanban, table, controls, tree, and file reads pass the signal through extension commands to host I/O. Workspace file and diff reads pass it to HTTP and response-body readers. Tree header, body, and footer reads drain together; expanded children use at most four concurrent loads. Composed navigation passes the same signal and stops starting contributions after cancellation.

Command scopes bind their host readers to the invocation signal. Reads check cancellation before dispatch and after each awaited operation; file reads also pass the signal into filesystem I/O. Cancellation cannot start the next child read, but already running work stays counted until it settles. Save operations and their path and permission checks do not inherit renderer read cancellation. Session and workspace creation keep their explicit lifecycle cancellation.

Refresh failures retain the last successful value for the same query. A first failure shows an error and Retry. A different query has its own initial loading state. File reads never clear a dirty draft, and saves retain their original binding when the user switches resources.

Tree queries include their bound resource, the current project and mode, and the page's navigation contribution owner when present. Trees also follow the current page resource unless their renderer supplies a data read key. Navigation contributions receive the selected resource by default. When their resource changes, they cancel old reads and clear old actions.

Host tree renderers can publish partial sections through the workbench's `TreeQueryContext.onProgress`. Progress belongs to the active read and is ignored after cancellation or completion. Background refreshes keep the last complete navigation until the replacement is ready.

Static host navigation and extension links have no selected resource dependency. Links with resource-based visibility conditions retain it. Extension navigation trees can declare `resourceScope: "project"` when their data belongs to the project independently of the selected resource. The default `"selection"` scope preserves selected-resource reads and cancellation for other trees. Changing modes still replaces their navigation.

## Tree resource movement

Tree nodes can opt into `canDrag` and `canDrop`. A native tree body can implement
`onMove(ctx, { renderer, state, source, target, position })` to persist the change through the
extension's public storage or artifact APIs. The callback receives the original
extension node identities, including when the host composes several trees in its
Sidenav. `position` is `"inside"` on a container or the tree background, and
`"before"` or `"after"` on the upper or lower half of a leaf row. `target` is omitted
for background drops; extensions decide whether their tree supports that destination.
The source tree's bound resource is preserved even if the selected resource changes.
Drops across contributions are rejected. Node flags control the gesture; the callback
must validate current permissions and source/destination data before writing. A successful callback refreshes
the owning tree; extensions should also emit their declared data event for other
views that depend on the changed resources.

## Declared data dependencies

Extensions use public `viewDataEvents` for host-owned session, workspace, and session-workspace link data. Events carry `projectId`. Reassignment invalidates both former and new owners; removals use the previous row. File and notification churn does not broadcast a view refresh. Each renderer also declares its own extension data events. The core extensions and host views declare these dependencies:

| Native view | Dependencies |
| --- | --- |
| Planner ticket board | `tickets.changed`, sessions, workspaces |
| Planner ticket tree | `tickets.changed`, sessions, workspaces |
| Planner editor and properties | `tickets.changed` |
| Notes tree, editor, and tab title | `notes.changed`, workspaces |
| Lab example board | Its storage collection event |
| Host session list and selected session | Sessions, workspace links, and linked workspaces |
| Host workspace table | Workspaces and workspace diff summaries |
