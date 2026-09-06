# @pstdio/workbench

The headless composition model and React shell for Prompt Studio hosts. Extension authors use the [SDK cookbook](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/extensions/cookbook.md). This guide covers host integration.

## Entry points

| Entry point | Purpose |
| --- | --- |
| `@pstdio/workbench` | Core, registries, controllers, and host contribution types |
| `@pstdio/workbench/react` | Shell, region components, and native renderers |
| `@pstdio/workbench/storage` | Browser persistence adapters |
| `@pstdio/workbench/extensions` | Checked extension metadata registration and host adapters |
| `@pstdio/workbench/webview-runtime` | Guest runtime for webview assets |

Install the declared React, React DOM, Chakra, and Emotion peers when using the React integration. Public declaration files include the private contracts they need. Package verification installs built entries outside the repository with full declaration checking.

The root, storage, and webview-runtime entries load without React. The React and extensions entries require the declared UI peers. Core Kanban contracts parameterize presentation values without choosing a UI framework. React host authors use `ReactAttributeDescriptor`, `ReactBoardColumnConfig`, and `ReactKanbanRendererContribution` from the React entry for checked cell and icon callbacks.

## Ownership

`pageLocations` owns durable navigation. A page transition resolves the page, resource, contextual parent, and mode before publishing location, composition, breadcrumbs, and browser history.

A page declares an optional resource constraint separately from Main presentation. `main.kind: "view"` presents its routed resource, with one or many instances. `main.kind: "panels"` presents peer Main panels and an empty view when none remain. `slots` holds page panels. The route continues to own context when a file or auxiliary inspector becomes active.

Page slots and mode placements share a static-view or resource-binding item. Static views declare `presence`; bindings declare `kinds`, `view`, `cardinality`, and optional `add`. Main, Side, and Secondary have the same meaning for both owners.

Modes supply shared placements, chrome, and region policy. Page navigation selects a mode. The host composes its default navigation whenever the active mode keeps that chrome. A replacement view or `false` overrides the default. Shared placements retain their identity across pages in the same mode.

Register host React views through the core view registry. Register checked extension metadata through the public extension adapter. Dispose the returned registrations when the owner is removed so its views, placements, and mounted content are released.

## Navigation and closing

Page targets change location. Panel targets open a page slot or mode placement while preserving the route. Its owner must be active. A compound target may contain page and panel steps only; resolve dependent targets against proposed state, then commit once. A failed preparation publishes no location, history, layout, selection, breadcrumb, or placement changes.

Commands and external links are standalone actions. A command that performs work and navigates must finish that work before requesting a target. The workbench cannot undo external effects.

Use `core.closePlacement(identity)` for owned tab closing. Native tabs and the `placement.close` webview capability use this controller. The host supplies the webview's actual placement identity. Fixed placements reject closing. Closing the last routed resource view follows the page's declared parent. Closing an auxiliary panel preserves location.

## Resource identity

Use the SDK's `ResourceRef` throughout host and extension APIs. Its required fields are `type` and `id`; `label` is presentation. Preserve optional extension and project ownership when forwarding a reference.

Use `resourceKey(resource)` for identity comparisons and layout indexes. Labels and metadata do not change identity. URI conversion belongs in location and persistence adapters. The default page codec preserves existing type/id locations and includes ownership when supplied.

`core.getPrimaryResource()` and resource providers receive the routed page resource. A workspace collection therefore retains workspace context while its active Main panel edits a file. Selection identifies the file separately.

Tab labels resolve from explicit tab presentation, then resource label, then view title. The close action uses the same label.

## Regions and mounting

Use `shell.setRegionOpen("side" | "secondary" | "sidenav", open)` to hide or show a region. Hiding retains its instances. Mode `regionSettings` owns size, collapsibility, headers, and tab visibility. `mountStrategy: "keep-mounted"` keeps an inactive tab's content mounted; removing its owner disposes it.

The side-panel controller owns attached, floating, or closed presentation. `floatingPanels: "hidden"` prevents floating and reattaches an already floating panel. Per-view menu preferences belong to `panelMenuState`; they do not duplicate region visibility.

## Persistence

The browser owns Back/Forward history. Page locations remain version 1. Existing resource locations and stored product data stay valid.

Layout cache version 4 records resource identity keys and the new Main collection model. Old layout entries are ignored. This revision does not invalidate tree state, menu preferences, side-panel presentation, or page locations. Collection page state uses the existing location key to separate workspaces.

Shared mode placements have one cache entry per project and mode. Page cache entries exclude them. Closing a shared panel therefore remains closed when another page is restored; switching projects does not restore another project's mode panels.

## Validation

Storybook's core guides describe host integration; extension guides use public SDK declarations. Use the repository's Docker workflow and Playwright for dashboard behavior. The release gates are `bun run validate` and `bun run --cwd scripts verify:packages`.

### Commit and host effects

Page and panel compound targets resolve against proposed state before live state changes. The browser adapter must implement atomic `push` and `replace`: if it throws, its history must remain unchanged. Browser serialization and writing happen before workbench owners publish the final state. A rejected navigation leaves the workbench unchanged.

Cache writes, mode lifecycle hooks, and subscribers are host effects after this boundary. Their exceptions are reported with the owner in the console and do not reject a committed navigation or stop other observers. A full cache can prevent restoration on the next launch, while the current location and panels remain usable. Fix the reported host effect at its source. A hook must clean up its own external effects if it fails before returning its disposables.
