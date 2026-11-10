# Failed startup navigation owns its cleanup

## When to use

When overlapping a document navigation with authentication or runtime startup, especially when Retry reuses the same native view.

## Failure

`Promise.all` rejected the failed runtime's login while its document navigation continued. Retry started a replacement in the same Electron WebContents. The unfinished navigation could abort the replacement with `ERR_ABORTED`, which recovery presented as an unexpected runtime exit even though the replacement API was ready.

## Prevention

- Keep parallel preparation within one runtime. On failure, abort the login, stop the navigation, and settle both before releasing their owner.
- Start the next runtime's document only after the prior preparation settles. Preserve the original failure if cleanup finds an already destroyed view.
- Retain the actual exception in diagnostic evidence. A friendly recovery code alone cannot identify whether startup, navigation, or the process failed.

## Evidence

- [Preparation and cleanup](../../clients/desktop/src/windows/workbench-loading.ts).
- [Ownership regressions](../../clients/desktop/src/windows/workbench-loading.p0.test.ts).
- [Runtime generation ordering](../../clients/desktop/src/windows/window-controller.ts).

A controlled real-Electron scenario on main reproduced the aborted replacement; the corrected scenario opens it. This establishes the defect without proving the cause of a historical CI failure whose original exception was discarded.
