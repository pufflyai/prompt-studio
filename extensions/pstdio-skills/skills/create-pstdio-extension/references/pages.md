# Pages and panels

A page owns a route, one primary slot in `main`, and optional auxiliary panels. A view owns its content.
Use `navigationItems` and `navigationTrees` for the shared Sidenav. Page slots do not target `sidenav`.

Start with the complete [Scribble, Zipline, and Pigeon examples](examples.md). They use native renderers
and the public SDK. The Workbench React showcases demonstrate host customization.

## Primary content

- A static primary declares `view`.
- A bound-only primary declares `binding` and a page `parent` for closing its last instance.
- A hybrid primary declares both. It shows the static view when no resource instance is open.

Every binding declares `cardinality`. `one` replaces the current resource; `many` keeps an instance
per resource. Use `open: "pin"` when navigation should retain a document instead of replacing a preview.
TypeScript checks the primary region, content, and bound-only parent. `pst extensions check` also
validates references and rules that need the whole extension.

## Navigation

Page targets name a page ref and may supply a resource. Use a nested `parent` page target for contextual
breadcrumbs. Name every destination explicitly. The host does not infer a page from resource metadata,
a resource kind, or a view. Without an explicit parent, it follows the declared page hierarchy.

A panel target uses `page.panels.<slot-id>` and leaves the current page location unchanged.

## Closing and automatic opens

Closing the last bound-only primary follows the page's declared parent, even when the breadcrumb has
a contextual parent. Closing the last hybrid primary resource returns to its static view.

`openOn: "page-resource"` opens an auxiliary binding on navigation with a matching resource. Closing
the instance keeps it closed until another navigation opens it. Navigation without a resource retains
existing auxiliary instances. Leaving the page removes its panels from the active layout.

The host's Side Panel can be closed, floating, or attached. This is a separate user choice. In the
dashboard, use Open Side Panel and Reattach Side Panel to inspect the examples. Closing a panel tab
removes that instance; closing the Side Panel window hides the container.

## Refresh installed guidance

Update `pstdio-skills` with the SDK release, then run `pst agents install-skills <agent-id>` from the
linked repository. This replaces managed skill copies. Restart the agent session to load the new
instructions. For source development, first use `pst extensions dev <path-to-pstdio-skills>`.
