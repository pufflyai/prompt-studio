---
status: "draft"
created: "2026-08-18T17:03:48.668Z"
---

# Product Requirements Document: Renderer Edit and Refresh Lifecycle

## Summary

Give editable native renderers a clear loaded, dirty, saving, and externally-invalidated lifecycle. Opening or saving an editor must not remount it, destroy selection, or trigger repeated unchanged saves.

## Problem

The ticket file renderer treats every editor onChange callback as a new edit, including the callback emitted when Lexical imports loaded Markdown. After its debounce, the save command emits the renderer's refresh event. The renderer clears its pending marker before the save finishes, handles its own event as an external refresh, reloads content, and changes the editor revision key.

The editor remounts, loses focus and selection, emits another initial onChange, and repeats. The loop also runs tree and property commands and accelerates the extension runtime memory leak.

## Goals

- Opening unchanged content performs no save.
- Editing preserves focus and selection before, during, and after save.
- A save does not cause its editor instance to reload itself.
- Clean editors reload real external changes.
- Dirty editors are never overwritten by a refresh event.
- Refresh work is scoped to affected resources when event data permits.
- The lifecycle is reusable by file renderers beyond tickets.

## Non-Goals

- Collaborative text merging.
- Conflict-free replicated data types.
- Offline write queues.
- Literal-copy assertions for bundled Markdown.
- Changing Lexical's document model.

## Concepts

| Term | Definition |
| ---- | ---------- |
| Loaded value | Last content accepted from the renderer load callback. |
| Draft | Current editor content. |
| Dirty | Draft differs from loaded or successfully saved value. |
| In-flight save | One active save request with a captured value. |
| Self invalidation | Refresh event caused by the current renderer's successful save. |
| External invalidation | Refresh event caused by another action or renderer instance. |

## Requirements

### Loading

1. The renderer stores the loaded value before mounting editable content.
2. An initial editor callback equal to the loaded value is ignored.
3. A clean reload with unchanged content does not change the editor revision or React key.
4. A clean reload with changed content updates the editor once.
5. A load failure keeps the current draft visible and reports a recoverable error.

### Editing and Saving

1. A user edit marks the renderer dirty and starts or resets the debounce.
2. One resource has at most one active save.
3. A newer draft created during a save remains dirty and is saved after the active request finishes.
4. Pending state remains owned until the save request settles.
5. Successful save updates the saved baseline without remounting the editor.
6. Failed save leaves the draft dirty and exposes retry.
7. Unmount flush behavior is explicit; it cannot silently drop a known dirty draft.

### Refresh Events

1. A renderer can identify the resource and renderer instance that caused a save event.
2. Self invalidation acknowledges saved state and does not call load.
3. A clean external invalidation calls load.
4. A dirty or saving renderer defers external reload.
5. After the draft saves, a deferred external invalidation loads only if it is newer than the completed save.
6. An event that names another resource does not reload the current renderer.
7. Event payload support is optional for generic events, but absence may cause a broader clean reload only.

### Focus and Selection

1. Saving does not replace the mounted editor.
2. A clean unchanged refresh does not replace the mounted editor.
3. Keyboard selection remains active across the save debounce and response.
4. The renderer does not force focus after an external navigation action.

## Proposed State Model

~~~text
loading
  → clean

clean
  → dirty                    user edit
  → loading                  external invalidation

dirty
  → saving                   debounce expires
  → dirty                    more edits

saving
  → clean                    saved value still current
  → dirty                    a newer draft exists
  → save-error               request fails

save-error
  → saving                   retry
  → dirty                    more edits
~~~

The implementation may use refs rather than storing each name as React state. The observable transitions and invariants are required.

## Event Contract Direction

~~~ts
type RendererRefreshEvent = {
  id: string;
  resourceUri?: string;
  origin?: {
    rendererId: string;
    instanceId: string;
    operationId: string;
  };
  revision?: string;
};
~~~

The host may add correlation metadata when dispatching a save command. Extension events remain domain-owned; the host only uses optional correlation and resource targeting.

## Success Metrics

| Metric | Baseline | Target | Measurement |
| ------ | -------- | ------ | ----------- |
| Saves after unchanged open | Repeats after debounce | Zero | Fake-timer renderer test |
| Focus after save | Lost | Preserved | Playwright active-element check |
| Selection after save | Lost | Preserved | Playwright selection assertion |
| Self-triggered reload | Repeats | Zero | Load/save/event counter |
| External clean refresh | Unreliable | One reload | Renderer lifecycle test |
| Dirty draft overwritten | Possible | Never | Deferred invalidation test |

## Rules and Constraints

- Equality uses the renderer's canonical serialized value.
- Save success cannot be inferred from receiving a refresh event.
- Refresh event order cannot overwrite a newer local draft.
- Tests use real renderer registration and event dispatch where practical.
- UI validation uses Playwright, as required by repository rules.

## Errors

| Error | Cause |
| ----- | ----- |
| Renderer load failed | The load callback rejected. |
| Renderer save failed | The save callback rejected; the draft remains dirty. |
| External changes pending | A newer external revision exists while a local draft is dirty. |

## Risks and Open Questions

- If the backing store cannot provide revisions, the host can prevent self-refresh and draft loss but cannot detect every concurrent write conflict.
- Flush-on-unmount may block navigation or require an explicit leave warning.
- Large documents need equality checks that do not cause input latency.

## Rollout Plan

1. Add failing lifecycle tests around the current file renderer.
2. Ignore initial and unchanged editor callbacks.
3. Correct save ownership and self-invalidation.
4. Add optional resource and origin metadata to refresh dispatch.
5. Add dirty external-invalidation behavior.
6. Validate ticket focus and selection with Playwright.

## Related Architecture

- [Extension Workbench Composition](../../architecture/extension-workbench-composition.md)
