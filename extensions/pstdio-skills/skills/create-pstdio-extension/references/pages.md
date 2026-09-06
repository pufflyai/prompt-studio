# Pages and panels

A page owns a route, one primary slot in `main`, and optional auxiliary panels. A view owns its content.
Use `navigationItems` and `navigationTrees` for the shared Sidenav. Page slots do not target `sidenav`.

Start with the complete [Scribble, Zipline, and Pigeon examples](examples.md). They use native renderers
and the public SDK. The Workbench React showcases demonstrate host customization.

## Primary content

- A static primary declares `view`.
- A resource primary declares `binding` and a page `parent` for closing its last instance.

Declare exactly one primary content source. Use two pages for a list and its details. Both pages can
share a view and mode. Put persistent panels, such as a player or timeline, in mode placements.

Every binding declares `cardinality`. `one` replaces the current resource; `many` keeps an instance
per resource. Use `open: "pin"` when navigation should retain a document instead of replacing a preview.
TypeScript checks the primary region, content, and resource parent. `pst extensions check` also
validates references and rules that need the whole extension.

## Navigation

Page targets name a page ref. Static pages take no resource; resource pages require one. Use a nested `parent` page target for contextual
breadcrumbs. Name every destination explicitly. The host does not infer a page from resource metadata,
a resource kind, or a view. Without an explicit parent, it follows the declared page hierarchy.

A panel target uses `page.panels.<slot-id>` and leaves the current page location unchanged.

## Closing and automatic opens

Closing the last resource primary follows the page's declared parent, even when the breadcrumb has
a contextual parent.

`openOn: "page-resource"` opens an auxiliary binding on navigation with a matching resource. Closing
the instance keeps it closed until another navigation opens it. Leaving the page removes its panels from the active layout.

The host's Side Panel can be closed, floating, or attached. This is a separate user choice. In the
dashboard, use Open Side Panel and Reattach Side Panel to inspect the examples. Closing a panel tab
removes that instance; closing the Side Panel window hides the container.

## Refresh installed guidance

Update `pstdio-skills` with the SDK release, then run `pst agents install-skills <agent-id>` from the
linked repository. This replaces managed skill copies. Restart the agent session to load the new
instructions. For source development, first use `pst extensions dev <path-to-pstdio-skills>`.

## Host pages

Use `workbenchPages.sessions` and `workbenchPages.workspaces` without a resource for their home pages.
Use `workbenchPages.session` with a `session` or `session-draft`, and `workbenchPages.workspace` with a
`workspace`. Detail pages declare their home page as `parent`.
