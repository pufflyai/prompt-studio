# Workbench cookbook

Build on the public `@pstdio/sdk/extensions` API. Install the SDK with Bun and keep `engines.pstdio` on the extension API version shipped with your host. This revision uses `1.0.0-alpha.10`.

Start with [Extension Lab](../../../extensions/extension-lab/README.md). It contains working tools with saved data, navigation, and custom modes. Copy the extension directory when trying it outside this repository; individual example modules import its shared files. Rename the package and publisher before installing your own copy.

```sh
bun install
bun run typecheck
pst extensions dev /absolute/path/to/your-extension
pst extensions check
```

Run `pst extensions dev` from a linked project. Keep it running while editing. It installs package dependencies and watches source changes. Native contributions load from TypeScript; webviews use the host's asset build. Changes to definitions, callbacks, and assets go through this same loop. Stop the watcher before a production installation with `pst extensions add --force <path>`.

## Ownership in one minute

A view supplies content. A page owns a route and its panels. A mode owns shared panels, region policy, and chrome. `ResourceRef` identifies data with `type`, `id`, and an optional `label`. Keep that reference intact when passing it between callbacks. An extension or project identity can distinguish data with the same type and id.

A page declares its routed resource separately with `resource: { kinds }`. Its `main` chooses either a view with `cardinality: "one" | "many"`, or peer panels with `kind: "panels"` and an `empty` view. Multiple routed view instances require a resource-bound page. That page declares a parent for closing its last resource tab.

Page `slots` and mode placements both use `item`. A static item declares `kind: "view"`, `view`, and `presence`. A resource item declares `kind: "binding"` with `binding: { kinds, view, cardinality, add? }`. Both use Main, Side, or Secondary. `page.panels.inspector` is the generated reference for a slot named `inspector`.

Choose extension-specific page IDs. Host page IDs such as `workspace`, `session`, `sessions`, and `start` are reserved; use the exported `workbenchPages` refs to target them.

Use a page target to change location. Use a panel target to open a panel and preserve location. A compound target contains only page and panel steps. The host prepares every step before publishing any state, then creates at most one history entry. Complete commands before requesting navigation; commands and external links are standalone actions.

## Editable resource pages

[Scribble's declaration](../../../extensions/extension-lab/src/examples/scribble.ts) selects the document view and a custom mode. [Its shared page definitions](../../../extensions/extension-lab/src/definition.ts) show `resource`, `main`, and the parent page. [Its editor](../../../extensions/extension-lab/src/apps/scribble.tsx) edits Markdown through the public UI package.

For a native editor, choose a view body with `kind: "file"`. Its `load` callback returns `fileName` and `content`; `save` receives the same renderer resource and the edited content. For a form, choose `kind: "controls"`. Return typed `params` or `groups` and values from `query`; use `onValueChange` to save. Control values are serializable. React nodes and browser files belong in UI components, outside declarations.

The [compiled controls example](../../../extensions/pstdio-skills/skills/create-pstdio-extension/references/examples/controls.ts) shows every required text and read-only field. Use `params.text(...)` for command parameters; renderer controls use their serializable control types.

Use `ctx.storage` for extension-owned data. The [Lab state commands](../../../extensions/extension-lab/src/state-commands.ts) save changes, emit the declared `examplesChanged` event, and return the saved result. The [native Zipline board](../../../extensions/extension-lab/src/examples/zipline-board.ts) declares `refreshEvents` and queries that same saved data. Native renderers refresh after saves and matching events; the author does not maintain a second host-side store.

Open resource pages with `open: "preview"` for replaceable tabs or `open: "pin"` for retained tabs. Reopening the same resource reuses its instance. The default tab title is the resource label, falling back to the view title. A tab query can supply an explicit label, icon, or indicator.

For a callback that refers to a page defined later, give the callback its public handler type. The [compiled table navigation example](../../../extensions/pstdio-skills/skills/create-pstdio-extension/references/examples/table-navigation.ts) uses `DataTableRendererRowActivationHandler` to avoid a TypeScript inference cycle.

`ctx.commands.execute(ref, { params })` returns a `CommandOutcome`. Check its `status` before reading `value`. A command with no parameters still takes `{}` as its invocation argument.

## Inspectors

[Zipline](../../../extensions/extension-lab/src/examples/zipline.ts) declares a Side inspector. Its slot uses the same resource binding as a mode placement. `cardinality: "one"` rebinds one instance; `"many"` retains independent resource instances.

Set `openOn: "page-resource"` when the inspector should open on matching page navigation. To inspect a row while keeping the route, return a panel target naming the page's generated panel reference and the row's resource. A panel target is valid while its page or mode owns the active location. To enter that owner and open its inspector together, use a compound page-and-panel target.

Explicit tab presentation wins over the resource label. Accessible close actions use that same label. Closing one inspector leaves other instances intact.

## Shared mode panels and navigation

[Boombox](../../../extensions/extension-lab/src/examples/boombox.ts) keeps its player in a mode placement. [Kiln](../../../extensions/extension-lab/src/examples/kiln.ts) does the same for its timeline. Page changes within the mode preserve the shared placement's identity. `mountStrategy: "keep-mounted"` preserves local view state while another tab is active. Removing the owning contribution disposes its instances.

`presence: "fixed"` keeps a static panel open and protects it from closing. `"open"` and `"closed"` set its first-visit state; saved user choices win on later visits. Hiding a whole region preserves its panels.

Omitted mode chrome keeps host navigation, including navigation items owned by your custom mode. Set `chrome.sidenav` to a view ref to replace it, or to `false` to hide it. Do not duplicate navigation in a webview to obtain the default sidebar. Region sizes, tab visibility, and collapsibility belong to the mode's `regionSettings`.

## Editor collections

Use `main: { kind: "panels", empty: emptyView.ref }` for a workspace-style editor. Put resource-bound editor slots in Main and tools in Side or Secondary. The empty view appears only while no Main panels are open.

The page may still declare a routed resource such as a workspace. Its location and breadcrumbs continue to refer to that workspace while files open, close, or change selection. A panel target opens a file without changing the route. Page state uses the existing location key, so different workspaces keep separate editor collections. This requires no hidden content panel.

## Cross-extension navigation

[Lab's public contracts](../../../extensions/extension-lab/src/contracts.ts) export refs using `qualifyRef(owner, ref)`. The helper qualifies contribution refs and nested page-panel refs while preserving command parameter and result types. Register local definitions inside the provider. Export qualified refs from its contract module.

A consumer imports `scribblePage` or `pigeonReader` from `extension-lab/contracts` and puts it in a page or panel target. Install the provider and consumer in the same project. Importing a provider's contract package does not enable its extension contributions. Let missing providers produce a navigation error; do not rewrite their ownership to the consumer.

Use a type-only import of the provider's commands record when creating a typed webview command client. That keeps command implementations out of the webview bundle.

## Webview lifecycle

[View mounting](../../../extensions/extension-lab/src/create-view.tsx) uses `defineExtensionView`, the supplied mount, and a cleanup function. Subscribe to the supplied props store when a mounted view needs updated resource or page context. Dispose subscriptions and the React root on unmount.

[Pigeon](../../../extensions/extension-lab/src/examples/pigeon.ts) declares `placement.close` for its reader. [The reader](../../../extensions/extension-lab/src/apps/pigeon.tsx) calls `host.call("placement.close", {})`. The host supplies the calling placement's identity. A webview cannot name a different tab. Fixed panels remain protected; closing the last routed resource returns to the page's declared parent.

Declare every capability before calling it. `GuestHost.call` checks names, parameters, and results through its capability maps. Runtime validation checks the same boundary for JavaScript callers. Use `createWebviewClient<typeof commands>(host)` for command-specific results rather than casting bridge responses.

## Check an authoring change

Typecheck with `skipLibCheck: false`. Fix the field named by `pst extensions check`; declaration errors identify the extension, contribution, field path, and expected value. Test edits, another resource, revisit, reload, Back/Forward, independent closing, and mode navigation through the normal dev installation.

These examples are repository TypeScript sources included in Extension Lab's typecheck and runtime checks. Host integration belongs in the [workbench guide](../../../packages/pstdio-workbench/README.md).
