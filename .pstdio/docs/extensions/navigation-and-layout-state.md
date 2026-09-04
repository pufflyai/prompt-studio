# Extension navigation and layout state

Every routed screen is a page. A page target is the only extension navigation action that changes the active page, URL, browser history, breadcrumb, and saved location.

```ts
const target = {
  kind: "page" as const,
  page: ticketPage.ref,
  resource: { type: "ticket", id: "PS-326", label: "PS-326" },
};
```

The workbench stores one canonical `PageLocation`:

```ts
interface PageLocation {
  page: PageRef;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  parent?: PageLocation;
}
```

The page chooses its declared mode. Callers do not switch a mode before opening a page. A direct URL wins over the saved location. Without either, the dashboard opens Start.

A panel target opens one declared auxiliary page slot or mode placement without changing `PageLocation`:

```ts
const target = {
  kind: "panel" as const,
  panel: ticketPage.panels.properties,
  resource: ticket,
};
```

Page and mode placements have separate owner identities. Switching pages removes only the outgoing page placements. Switching modes removes the outgoing page and mode placements together. Saved layout state can restore only placements owned by the active page and mode.

Use an explicit `parent` page target when a navigation is contextually below the current page. Breadcrumbs project that parent chain and store a target on every clickable crumb.
