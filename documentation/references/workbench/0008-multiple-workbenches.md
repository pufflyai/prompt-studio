# Multiple workbenches in one window

A host can retain several `Workbench` instances and show one at a time. A hidden workbench keeps its views, editors, subscriptions, and local state. Activation controls window effects; it does not pause extension work.

## Host ownership

`createWorkbench()` starts active. A host with several workbenches creates background instances with `active: false`. On a switch, deactivate the previous instance before activating the next:

```ts
import { createWorkbench } from "@pstdio/workbench";

const first = createWorkbench();
const second = createWorkbench({ active: false });

first.activation.setActive(false);
second.activation.setActive(true);
```

Render each instance with `Workbench` from `@pstdio/workbench/react`. Keep those components mounted during a switch. The component hides its inactive surface and makes it inert. Only the active workbench handles shortcuts, forwards iframe keyboard events, publishes browser navigation, and applies the window theme. Background navigation updates its own location. Activating it publishes that location without remounting its views.

When several workbenches share window navigation, pass the same `pageLocationBrowser` object to each `createWorkbench` call. The shared adapter coordinates native Back and Forward with each owner's private history. Separate adapter objects represent separate navigation surfaces, even if their implementation uses the same browser window.

The host must keep exactly one workbench active. Closing a workbench is a separate operation: unmount its component and call `dispose()` after completing the host's save flow.

## Saved view state

Pass a distinct, stable `scope` to `createLocalStorageWorkbenchPersistence` for each retained project. Use the same storage object and namespace for the window. Tree expansion, status order, and layout write generations belong to that scope. User preferences remain shared and are updated from the current stored values.

`createLocalStorageWorkbenchPersistence` supplies `storageScope` to `createWorkbench`. `Workbench` uses that identity to scope UI host storage. Hosts with other persistence adapters can set `storageScope` directly on `createWorkbench`. Leaving it unset preserves existing standalone storage keys. This covers collection filters, table settings, and tab visibility. Continue to supply `HostStorageProvider` when the host stores UI state outside browser storage. Diff viewers own their transient selection, search, and expansion state per component.

## Custom views and overlays

Use the exported UI components. For a custom overlay, use `ScopedDialog`, `ScopedMenu`, `ScopedPopover`, and `Portal` from `@pstdio/ui`. Use `useScopedMenu` with a menu root provider. These roots release document listeners and focus traps while hidden, and retain their open state for activation. Standalone callers outside a workbench keep their usual behavior.

Use `useToaster()` for surface-owned feedback. The module-level `toaster` remains the standalone queue. Workbench notifications use separate queues, so matching notification IDs in different workbenches cannot dismiss each other. System errors stay in their owner's status bar.

See [the workbench API](0002-api.md), [navigation](0004-navigation.md), and [webview hosts](0005-webview-hosts.md). Desktop project tab retention is host wiring and is separate from this contract.
