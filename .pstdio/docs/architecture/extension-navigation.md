# Extension navigation

PS-326 routes screens through pages. Each page declares its mode and primary content. Navigation
names a page explicitly; resource kinds and views do not choose routes or breadcrumb destinations.

## Page targets

```ts
const target = {
  kind: "page" as const,
  page: ticketPage.ref,
  resource: { type: "ticket", id: "PS-326", label: "PS-326" },
};
```

The page-location controller resolves the page, validates its resource against the primary binding,
and resolves its parent chain before committing a location. The page runtime activates the declared
mode and reconciles owned placements. A failed target leaves the current location unchanged.

The canonical `PageLocation` contains the page ref, optional resource and document section, and
optional parent location. URLs, browser history, breadcrumbs, and saved navigation use that location.
Panels can open without replacing it, through a `kind: "panel"` target.

## Contextual parents

A target may supply a nested `parent` page target. For example, Planner opens a workspace under the
specific ticket page that owns it. Planner knows its ticket hierarchy and constructs that chain.
The host does not select the first page that accepts a resource kind or displays a view.

Without an explicit parent, the controller uses the page's declared parent. Breadcrumbs project the
canonical chain and retain an explicit target for each ancestor. A separate resource hierarchy
provider can describe domain relationships, but it does not choose navigation destinations.

## Placement lifetime

The visible layout combines shell, mode, and page placements. Leaving a page removes its placements;
leaving a mode removes that mode and its active page. Ownership is independent of region.

A close action commits the resolved remaining instances. It does not replay automatic auxiliary
opens. Closing the last primary instance of a bound-only page navigates to its declared parent.
A hybrid primary returns to its static view.

`openOn: "page-resource"` opens matching auxiliary bindings when navigation supplies a resource.
Navigation without a resource retains existing auxiliary instances. The Side Panel container's
visibility remains a separate user choice.

See [navigation and layout state](../extensions/navigation-and-layout-state.md),
[composition](../extensions/contextual-workbench-composition.md), and the
[runnable examples](../../../extensions/extension-lab/src/examples).
