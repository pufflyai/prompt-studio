# Executable extension examples

Use these TypeScript and TSX files as the source for authoring snippets. They are compiled by the skills package's typecheck and shipped with this skill. All use public SDK imports. Copy each example with its local imports; the resource reviewer is a folder, not a single-file snippet.

- [Resource reviewer](examples/resource-reviewer/extension.ts) combines a searchable catalog, native tree, custom preview, attached native inspector, and event-driven refresh. Start here for a review or editing tool.
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

A webview declares `placement.close` and calls `host.call("placement.close", {})` to close itself. The host supplies its placement identity and protects fixed panels. Native tabs use the same controller. Single-resource Main views are fixed. Closing the last tab on a page supporting multiple resources follows the page's declared parent.

See [pages](pages.md) for ownership and [validation](validation.md) for the installation loop.

Native [controls.ts](./examples/controls.ts) shows typed text and read-only fields, storage, refresh events, and command outcomes. [table-navigation.ts](./examples/table-navigation.ts) shows a typed callback that refers to a page defined later. These files compile with the skill package.

## Resource reviewer

Copy the complete `examples/resource-reviewer` folder into an extension package. Set `main` to its `extension.ts`, and keep its `preview-entry.tsx` package asset inside that package. For the example, use package name `resource-reviewer`, publisher `examples`, display name `Resource reviewer`, `type: "module"`, and the supported host version from the [manifest guidance](extension-api.md). When adapting its identity, update the qualified event owner in `catalog.ts` to match the resulting extension ID. Choose [scope](scope.md) for the actual user request; the example does not require a custom mode or host chrome overrides.

| File | Responsibility |
| --- | --- |
| [catalog.ts](examples/resource-reviewer/catalog.ts) | Synthetic items, defaults, and a typed change-event reference |
| [extension.ts](examples/resource-reviewer/extension.ts) | Resource page, tree, palette provider, navigation, and attached menus |
| [commands.ts](examples/resource-reviewer/commands.ts) | Read and save settings by resource ID; emit after saving |
| [inspector.ts](examples/resource-reviewer/inspector.ts) | Native grouped controls, information, and explicit Apply |
| [style-types.ts](examples/resource-reviewer/style-types.ts) | TypeScript declaration for the shared CSS import |
| [preview-entry.tsx](examples/resource-reviewer/preview-entry.tsx) | Shared UI styles, theme provider, mount, and disposal |
| [preview.tsx](examples/resource-reviewer/preview.tsx) | Scrollable preview with a fixed local toolbar and resource rebinding |
| [use-review-settings.ts](examples/resource-reviewer/use-review-settings.ts) | Typed reads, event subscriptions, and stale-read protection |

Declare these runtime dependencies in the consuming extension: `@pstdio/sdk` and `@pstdio/ui` at `^0.35.0`, `@chakra-ui/react` at `3.32.0`, `@emotion/react` at `^11.0.0`, and `react` plus `react-dom` at `19.2.4`. For typechecking, use TypeScript with `jsx: "react-jsx"` and `@types/react` plus `@types/react-dom` at `^19.2.0`. These are the example's current baseline, not a rule to downgrade other extensions. Include both `.ts` and `.tsx` in the consuming package's typecheck.

Open **Resource reviewer** under Tools, or search for **Release checklist** or **Design handoff** in the command palette. Change fields in Properties and press Apply. Reset settings in the preview to see the inspector refresh in the other direction. Each item retains its own saved settings; loading, save status, and scroll position remain local UI state.

## Larger application references

The complete [Extension Lab](https://github.com/pufflyai/prompt-studio/tree/main/extensions/extension-lab) provides additional applications. Its [Kiln composition](https://github.com/pufflyai/prompt-studio/blob/main/extensions/extension-lab/src/examples/kiln.ts) places a viewport in Main, an inspector in Side, and a timeline in Secondary. That timeline placement is a product choice. Keep controls inside Main when they belong to one preview, as the reviewer does. Copy the complete Extension Lab package when exploring Kiln; its module depends on shared files and is not a standalone snippet.
