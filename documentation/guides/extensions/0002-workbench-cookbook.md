# Workbench cookbook

Recipes for pages, inspectors, shared panels, editors, and navigation in the dashboard. Each recipe links to a working example.

The recipes use the public `@pstdio/sdk/extensions` API. If you have not built an extension yet, start with [Write an extension](0001-authoring.md).

## Try the examples

The examples come from [Extension Lab](../../../extensions/extension-lab/README.md), a set of complete tools with saved data, navigation, and custom modes. Its examples share files, so copy the whole `extensions/extension-lab` folder from the Prompt Studio repository. Rename the package and publisher before you install your copy.

Run the watcher on your copy from a project folder, and check it:

```sh
pst extensions dev /absolute/path/to/your-extension
pst extensions check
```

`pst extensions dev` installs the package dependencies, then watches the source. Keep it running while you edit. Changes to declarations, callbacks, and webview files all reload through the same loop. Stop the watcher before you install a final version with `pst extensions add --force <path>`.

Set `engines.pstdio` to a caret range of the extension API version your Prompt Studio ships, such as `^0.1.0`. The range keeps the extension loading across releases that only add features. See [API versioning](../../references/extensions/0014-api-versioning.md).

## Who owns what

A view supplies content. A page owns an address in the dashboard and the panels on it. A mode owns the panels shared across its pages, the rules for its regions, and its chrome: the bars around the content, such as the sidebar and the status bar. A resource is one item of your data, such as a document or a ticket. `ResourceRef` identifies it with `type`, `id`, and an optional `label`. Pass the reference on unchanged between callbacks. Its extension and project fields keep items with the same type and ID apart.

A page declares its routed resource separately with `resource: { kinds }`. Its `main` chooses either a view with `cardinality: "one" | "many"`, or peer panels with `kind: "panels"` and an `empty` view. Multiple routed view instances require a resource-bound page. That page declares a parent for closing its last resource tab.

Page `slots` and mode placements both use `item`. A static item declares `kind: "view"`, `view`, and `presence`. A resource item declares `kind: "binding"` with `binding: { kinds, view, cardinality, add? }`. Both use Main, Side, or Secondary. `page.panels.inspector` is the generated reference for a slot named `inspector`.

Choose extension-specific page IDs. Host page IDs such as `workspace`, `session`, `sessions`, and `start` are reserved; use the exported `workbenchPages` refs to target them.

Use a page target to change location. Use a panel target to open a panel and preserve location. A compound target contains only page and panel steps. The host prepares every step before publishing any state, then creates at most one history entry. Complete commands before requesting navigation; commands and external links are standalone actions.

## Editable resource pages

[Scribble's declaration](../../../extensions/extension-lab/src/examples/scribble.ts) selects the document view and a custom mode. [Its shared page definitions](../../../extensions/extension-lab/src/definition.ts) show `resource`, `main`, and the parent page. [Its editor](../../../extensions/extension-lab/src/apps/scribble.tsx) edits Markdown through the public UI package.

For a native editor, choose a view body with `kind: "file"`. Its `load` callback returns `fileName` and `content`; `save` receives the same renderer resource and the edited content. For a form, choose `kind: "controls"`. Return typed `params` or `groups` and values from `query`; use `onValueChange` to save. Control values are serializable. React nodes and browser files belong in UI components, outside declarations.

The [compiled controls example](../../../extensions/pstdio-skills/skills/create-pstdio-extension/references/examples/controls.ts) shows every required text and read-only field. Use `params.text(...)` for command parameters; renderer controls use their serializable control types.

Use `ctx.storage` for extension-owned data. The [Lab state commands](../../../extensions/extension-lab/src/state-commands.ts) save changes, emit the declared `examplesChanged` event, and return the saved result. The [native Zipline board](../../../extensions/extension-lab/src/examples/zipline-board.ts) declares `refreshEvents` and queries that same saved data. Native views refresh after saves and matching events, so you do not keep a second copy of the data for the view.

Open resource pages with `open: "preview"` for replaceable tabs or `open: "pin"` for retained tabs. Reopening the same resource reuses its instance. The default tab title is the resource label, falling back to the view title. A tab query can supply an explicit label, icon, or indicator.

For a callback that refers to a page defined later, give the callback its public handler type. The [compiled table navigation example](../../../extensions/pstdio-skills/skills/create-pstdio-extension/references/examples/table-navigation.ts) uses `DataTableRendererRowActivationHandler` to avoid a TypeScript inference cycle.

`ctx.commands.execute(ref, { params })` returns a `CommandOutcome`. Check its `status` before reading `value`. A command with no parameters still takes `{}` as its invocation argument.

## Inspectors

[Zipline](../../../extensions/extension-lab/src/examples/zipline.ts) declares a Side inspector. Its slot uses the same resource binding as a mode placement. `cardinality: "one"` rebinds one instance; `"many"` retains independent resource instances.

Set `openOn: "page-resource"` when the inspector should open on matching page navigation. To inspect a row while keeping the route, call `ctx.navigation.open()` with a panel target naming the page's generated panel reference and the row's resource. A panel target is valid while its page or mode owns the active location. To enter that owner and open its inspector together, use a compound page-and-panel target.

Explicit tab presentation wins over the resource label. Accessible close actions use that same label. Closing one inspector leaves other instances intact.

## Shared mode panels and navigation

[Boombox](../../../extensions/extension-lab/src/examples/boombox.ts) keeps its player in a mode placement. [Kiln](../../../extensions/extension-lab/src/examples/kiln.ts) does the same for its timeline. Page changes within the mode preserve the shared placement's identity. Visited registered views stay mounted while navigating between pages, tabs, and modes in the same project. Inactive views are hidden and cannot receive focus or pointer input. Returning reuses the live iframe and its local state. Retention ends when the view contribution is removed, the project changes, or the workbench closes. A full reload starts new views. `mountStrategy: "keep-mounted"` also mounts inactive panel placements before their first selection.

`presence: "fixed"` keeps a static panel open and protects it from closing. `"open"` and `"closed"` set its first-visit state; saved user choices win on later visits. Hiding a whole region preserves its panels.

Omitted mode chrome keeps host navigation, including navigation items owned by your custom mode. Set `chrome.sidenav` to a view ref to replace it, or to `false` to hide it. Do not duplicate navigation in a webview to obtain the default sidebar. Region sizes, tab visibility, and collapsibility belong to the mode's `regionSettings`.

## Editor collections

Use `main: { kind: "panels", empty: emptyView.ref }` for a workspace-style editor. Put resource-bound editor slots in Main and tools in Side or Secondary. The empty view appears only while no Main panels are open.

The page may still declare a routed resource such as a workspace. Its location and breadcrumbs continue to refer to that workspace while files open, close, or change selection. A panel target opens a file without changing the route. Page state uses the existing location key, so different workspaces keep separate editor collections. This requires no hidden content panel.

## Cross-extension navigation

[Lab's public contracts](../../../extensions/extension-lab/src/contracts.ts) export refs using `qualifyRef(owner, ref)`. The helper qualifies contribution refs and nested page-panel refs while preserving command parameter and result types. Register local definitions inside the provider. Export qualified refs from its contract module.

A consumer imports `scribblePage` or `pigeonReader` from `extension-lab/contracts` and puts it in a page or panel target. Install the provider and consumer in the same project. Importing a provider's contract package does not enable its extension contributions. Let missing providers produce a navigation error; do not rewrite their ownership to the consumer.

Use a type-only import of your own extension's commands record when creating a typed webview client. This keeps implementations out of the bundle. The client targets the calling extension by default; importing another provider's types does not route commands to that provider. Cross-extension calls require an explicit qualified command ref and the corresponding declared capability.

## Webview lifecycle

[View mounting](../../../extensions/extension-lab/src/create-view.tsx) uses `defineExtensionView`, the supplied mount, and a cleanup function. Subscribe to the supplied props store when a mounted view needs updated resource or page context. Dispose subscriptions and the React root on unmount.

[Pigeon](../../../extensions/extension-lab/src/examples/pigeon.ts) declares `placement.close` for its reader. [The reader](../../../extensions/extension-lab/src/apps/pigeon.tsx) calls `host.call("placement.close", {})`. The host supplies the calling placement's identity. A webview cannot name a different tab. Fixed panels remain protected; closing the last routed resource returns to the page's declared parent.

Declare every capability before calling it. `GuestHost.call` checks names, parameters, and results through its capability maps. Runtime validation checks the same boundary for JavaScript callers. Use `createWebviewClient<typeof commands>(host)` for command-specific results rather than casting bridge responses.

## Add resource actions to a tree row

Declare the resource represented by a row separately from the page it opens. The host resolves that resource's
registered menu actions, so a tree does not need its own copy of ticket or workspace actions.

```ts
const resource = { type: "ticket", id: ticket.id, label: ticket.title };
const node: TreeNode = {
  id: ticket.id,
  label: ticket.title,
  resource,
  target: { kind: "page", page: ticketPage.ref, resource },
};
```

Here `TreeNode` is imported from `@pstdio/sdk/extensions`, and `ticketPage` is the extension's declared page.
Include the page's declared parent in the target when it requires one.

For a file displayed inside a ticket page, the destination and action subject differ. Keep the ticket page
target and supply commands that receive the specific file IDs:

```ts
const node: TreeNode = {
  id: file.id,
  label: file.name,
  target: ticketDocumentTarget,
  contextMenuActions: [
    {
      id: "delete",
      label: "Delete",
      command: deleteTicketFileCommand.ref,
      params: { ticketId: ticket.id, fileId: file.id },
    },
  ],
};
```

`ticketDocumentTarget` opens the ticket page with the selected document. Omitting a ticket resource from this file
row prevents ticket operations from appearing in its menu. Opening the menu does not navigate. The action still
uses the clicked file when another document is active. Actions with input fields use the standard parameter dialog.

## Check an authoring change

Typecheck the extension with `skipLibCheck: false`. Fix the field named by `pst extensions check`; declaration errors identify the extension, contribution, field path, and expected value. With `pst extensions dev` running, test edits, another resource, revisiting, reloading, Back and Forward, closing panels one at a time, and moving between modes.

The linked examples are compiled and tested with Extension Lab, so they match the current API. To build your own host app on the workbench, see the [Workbench reference](../../references/workbench/0001-overview.md).
### Session rows

A session may open a preview panel while retaining its own action identity:

```ts
const resource = { type: "session", id: session.id, label: session.title };
const node = {
  id: `session-${session.id}`,
  label: session.title,
  resource,
  target: { kind: "panel", panel: workbenchPanels.projectSession, resource, open: "preview" },
} satisfies TreeNode;
```

Import `TreeNode` and `workbenchPanels` from `@pstdio/sdk/extensions`. Use the existing `sessionSlots` menu refs to contribute session commands. The host supplies the row resource as command context and preserves it when collecting parameters.
