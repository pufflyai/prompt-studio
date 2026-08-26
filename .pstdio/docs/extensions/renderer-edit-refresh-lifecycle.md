---
status: "shipped"
created: "2026-08-18T17:03:48.668Z"
updated: "2026-08-19"
---

# Renderer Edit and Refresh Lifecycle

## Summary

Editable native file renderers have one owner for loaded content, the current draft, one active save, errors, and external invalidation. Opening or saving an editor does not remount it, destroy selection, or cause repeated unchanged saves.

## Goals

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
- the resource URI, including document-selection metadata in the renderer load key.

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
  resourceUri?: string;
  origin?: {
    rendererId: string;
    instanceId: string;
    operationId: string;
  };
  revision?: string;
}
~~~

Generic extension events remain valid with only `id`.

Each file save receives a host operation origin. The file renderer adapter places the origin and resource URI in command request metadata. They are not added to extension params or extension-owned event payloads. After the command returns, the dashboard attaches that host context to each published refresh event. A save result may return an optional revision.

## Refresh Classification

- An event naming another resource is ignored.
- An event matching the active or recently completed save operation is self invalidation. It never loads.
- A clean external event loads once.
- Duplicate events with the same revision do not load twice.
- A dirty, saving, or save-error binding defers and coalesces external events.
- After save, a deferred revision loads only when it is newer than the save result revision.
- Without revisions, a deferred generic external event performs one broader reload after local save state settles.
- A generic event cannot detect every concurrent write. It still never overwrites a known local draft.

Revisions are compared as ordered strings. Current Planner revisions are ISO timestamps from the existing ticket or file `updatedAt` value.

## Focus and Selection

Debounce, save completion, self invalidation, and unchanged clean reloads keep the editor key stable. The renderer does not force focus after navigation or after a real external document change.

The Planner browser regression holds a non-collapsed DOM selection, waits beyond the debounce, waits for stored content to confirm the save response, and checks both the active element and selection before and after completion.

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

## Shipped Surfaces

- Reusable controller: `packages/pstdio-workbench/src/react/renderers/file/file-renderer-edit-state.ts`
- React integration: `packages/pstdio-workbench/src/react/renderers/file/file-renderer-view.tsx`
- Registry envelope: `packages/pstdio-workbench/src/core/registries/renderers/file-renderer-registry.ts`
- Extension adapter and host refresh: `packages/pstdio-workbench/src/extensions`
- Dashboard event feed: `packages/pstdio-dashboard/src/shared/extensions/extension-webview-broadcast.ts`
- Real consumer: Planner ticket-content file view
