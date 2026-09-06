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

Closing the selected pinned resource activates a remaining resource and updates its `openOn: "page-resource"` panels. Closing an inactive resource or an auxiliary panel keeps the current resource and any manually closed panels unchanged.

Without an explicit parent, navigation uses the page's declared hierarchy. The host never chooses a
parent page by resource kind or view. Closing the last resource primary instance always follows
the declared parent.

A static page declares a primary `view`. A resource page declares a primary `binding` and requires a
resource when opened. Use separate pages for a list and its details, with the list as the detail page's
`parent`. Both pages can share a mode. Put panels that must stay mounted across them in that mode.

 Every panel hides its tab strip when only one tab is open,
including closable auxiliary panels. Set `alwaysShowTabs` to keep a lone tab and its Close button
visible. Header actions and detach controls remain available without tabs. An attached Side Panel
omits its header when it has no tabs, custom header, menus, or controls, like the Secondary Panel.

Navigation trees follow the refresh events declared by their source views. A file creation or other
change can refresh a contributed navigation tree without reloading the page. Dashboard commands
that return a session open that session in the Side Panel and keep the current ticket page active.

`openOn: "page-resource"` opens a matching auxiliary binding on resource navigation. Closing the
instance does not replay that open action. Leaving a resource page removes its page-owned panels from the active layout. The Side Panel's open, attached, or floating state remains a separate user choice.

Host navigation uses separate refs for home pages and resources:

| Destination | Page ref | Resource |
| --- | --- | --- |
| New session home | `workbenchPages.sessions` | None |
| Session or draft | `workbenchPages.session` | `session` or `session-draft` |
| Workspace list | `workbenchPages.workspaces` | None |
| Workspace details | `workbenchPages.workspace` | `workspace` |

Extension pages follow the same rule. Split a primary that declares both `view` and `binding` into
separate pages with distinct IDs and paths. Give the resource page a `parent` pointing to the static
page, then update each navigation target to name its destination. Existing resource URLs must use
the new resource page path.
