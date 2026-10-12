# Webview patterns

Use a webview for content that native file, tree, table, board, or controls views cannot express. Prefer a native controls view for ordinary parameters: the host provides the parameter editor, form state, and scrolling. Use the public `@pstdio/ui/param-editor` export when a custom webview actually needs an embedded form.

## Mount shared UI and own only the content

The typechecked [preview entry](examples/resource-reviewer/preview-entry.tsx) imports `@pstdio/ui/style.css`, mounts React inside `defineExtensionView`, supplies `ChakraProvider` with `psTheme`, and returns `root.unmount` as cleanup. Declare the bridge capabilities the webview calls; the reviewer needs `commands.execute`.

Use exported shared UI components, semantic tokens, text styles, and recipe variants. Use a basic Chakra layout primitive when the UI package has no matching component. Do not recreate the host's navigation, panel splitters, tabs, or page title inside the content.

The [preview](examples/resource-reviewer/preview.tsx) shows a bounded layout:

- The webview root fills its viewport and contains overflow.
- Its column and shrinking children have `minH="0"` and `minW="0"`.
- The content takes the remaining space with `flex="1"`; the toolbar uses `flexShrink="0"`.
- `ScrollArea` owns scrolling inside the content. A canvas or player should instead fit that bounded area without contributing its intrinsic dimensions to the surrounding flex layout.

Use one scroll owner for each scrollable region. An outer `overflow="auto"` adds a browser scrollbar around the shared one. Do not use clipping to hide controls that need responsive layout or scrolling.

## Share saved state through commands and events

Follow the reviewer's [commands](examples/resource-reviewer/commands.ts), [native inspector](examples/resource-reviewer/inspector.ts), and [subscription hook](examples/resource-reviewer/use-review-settings.ts):

1. Read and write through typed commands. Import the commands record with `import type` in browser code and use `createWebviewClient<typeof commands>(host)`.
2. Store settings by resource ID in the command handler. This example uses the extension's project storage; choose a different storage scope only when the data's ownership requires it.
3. Emit a typed event after the write succeeds. Native views declare that event in `refreshEvents`.
4. Webviews subscribe with `client.events.subscribe(eventRef, refetch)` before the initial read. The callback is an invalidation signal, not the event payload; refetch the current resource. The SDK also invalidates after a host-sync reconnect.
5. Unsubscribe when the view unmounts or changes resource. Ignore reads from an earlier resource or superseded request. The example keys its preview by resource ID so rebinding also clears transient loading and save state.

The inspector uses Apply to commit a complete settings value. Reset uses the same update command. Errors remain visible and failed writes do not emit a successful change event. This example does not promise concurrent field merging; choose explicit field-level commands when separate writers must edit independently.

Loading, focus, and save progress belong to the local view. Persist state only when it must survive reopening or coordinate with another view. Do not synchronize views through module globals, polling, `lastCommand`, or a second copy of authoritative settings in browser storage.

## Keep browser and backend dependencies separate

The extension definition and command handlers run on the backend. The webview entry runs in the browser. Keep shared IDs, types, and pure data in a small module; keep React, DOM code, styles, and browser-only libraries out of backend imports. Use type-only imports for command inference so handlers are not bundled into the browser.

Declare direct dependencies in the consuming package. A helper workspace can expose a browser entry and a backend-safe entry using package exports when it serves both environments. Check that every imported subpath is exported; do not replace a missing export with a deep relative import into another package.

`workspace:*` is appropriate only inside a workspace containing that dependency. A portable extension install needs published versions or packaged local dependencies. For local dependency fixtures, follow the directory and symlink rules in [validation](validation.md); do not assume the author's repository `node_modules` will be available on another machine.

A host reload defect, package resolver defect, or shared UI initialization defect belongs to the platform. Do not add aliases, global initialization hacks, or chrome overrides to these general examples. Report the failing entry and versions, and keep any necessary temporary exception with its owning ADR rather than teaching it as the normal authoring pattern.

For copy actions, add `clipboard.write` to the view capabilities and use `CopyButton` from `@pstdio/ui`. Writes happen in the guest click handler; there is no clipboard bridge method. Clipboard reads are not supported.
