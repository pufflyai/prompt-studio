# Executable extension examples

Use these TypeScript files as the source for authoring snippets. They are compiled by the skills package's typecheck and shipped with this skill. The four complete examples export a `defineExtension` value. The controls and table-navigation files below provide smaller helpers. All use public SDK imports. Keep its helpers when copying it into an existing extension.

- [Commands and resource actions](examples/commands.ts) shows typed parameters and resource menu ownership.
- [Scribble documents](examples/scribble.ts) shows an editable native file view, storage, routed resources, pinned tabs, and a navigation tree.
- [Zipline inspector](examples/zipline.ts) shows a native board and a Side resource binding.
- [Pigeon reader](examples/pigeon.ts) shows a table, explicit row activation, and a resource-bound reader.

These are the existing instruction examples updated to the current contracts. The full Extension Lab package supplies complete applications, state commands, webviews, custom modes, and themes. Copy that whole directory when trying its examples; its modules import shared files.

A page declares `resource` independently from `main`. Its extra `slots` and a mode's placements share the same `item` union. Use `main.kind: "panels"` with an `empty` view for peer Main editors. This preserves the routed workspace while files open as panels.

`page.panels.inspector` names a generated panel reference. A panel target preserves the current route. `openOn: "page-resource"` opens a matching inspector during page navigation. A compound target contains only page and panel steps and commits only after all steps resolve.

Native views declare `refreshEvents` to reload after matching events. Save through `ctx.storage`, emit the event after persistence completes, and return the saved value. Controls query results contain `params` or typed `groups`, together with `values`.

Omit custom mode chrome to retain host navigation. A view ref replaces that chrome; `false` hides it. Do not create a duplicate sidebar to make navigation items appear.

Provider contract modules export `qualifyRef(owner, ref)` results. Register local definitions in the provider. Import its qualified refs from a consumer; this preserves command types and page-panel ownership across installations.

A webview declares `placement.close` and calls `host.call("placement.close", {})` to close itself. The host supplies its placement identity and protects fixed panels. Native tabs use the same controller. Closing the last routed resource view follows the page's declared parent.

See [pages](pages.md) for ownership and [validation](validation.md) for the installation loop.

Native [controls.ts](./examples/controls.ts) shows typed text and read-only fields, storage, refresh events, and command outcomes. [table-navigation.ts](./examples/table-navigation.ts) shows a typed callback that refers to a page defined later. These files compile with the skill package.
