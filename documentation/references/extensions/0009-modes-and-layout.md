# Modes and layout

A mode is a workbench context with its own docked regions, chrome, and theme. This page covers modes, mode placements, chrome, and region settings.

A page declares its base mode, so opening a page always selects the correct mode.

Use `definePlacement` only for content that should remain across pages in that mode:

```ts
definePlacement({
  id: "sessions",
  mode: workbenchModes.project,
  item: { kind: "view", view: sessions.ref, presence: "open" },
  region: "side",
});
```

A placement can show a static view or bind a resource kind to a view. A static item declares `presence`: `open` (open until the user closes it) or `closed` (opened from the Add panel). The deprecated `fixed` value behaves like `open` in tab regions. Every tab can close. Chrome regions have no tabs and stay shown with their owner. A binding item declares `cardinality` (`one` rebinds a single instance, `many` opens one instance per resource) and an optional `add` action for the Add panel. A placement may also declare `order` and `addableIn`. The latter chooses the panels whose Add menu and default placeholder offer the tool. Region size and collapsibility belong to the mode's `regionSettings`, not to placements. Region choices are `main`, `secondary`, and `side`; navigation normally belongs in the shared Sidenav tree.

Use `definePage` for routed content. Do not model a page as a mode placement, and do not switch a mode as a separate navigation step. A page target activates the page and its declared mode as one transaction.

Mode and page placements are additive. If both use `side`, both appear. Main tabs belong to their page context; a resource-free panel collection shares that context with its detail routes. Page tabs moved into Side or Secondary stay across pages in the same mode and hide when switching modes. Moving a preview pins it first. User open state is stored against the complete owner identity and cannot leak into another page or mode.

## Themes and custom chrome

Set `canFullscreen: false` on a mode to disable Main fullscreen. The host hides its fullscreen control and rejects the matching command and controller entry. Modes allow fullscreen by default. This policy is independent of tab presentation and custom chrome.

A mode may declare `defaultTheme: theme.ref`. References are qualified with the extension owner during normalization. The workbench applies the theme when entering the mode unless the user has saved another theme for that mode. The default does not replace the global preference. Leaving restores the global preference; returning restores the mode preference.

```ts
const mode = defineMode({
  id: "notes",
  label: "Notes",
  regions: ["main"],
  defaultTheme: paperTheme.ref,
  chrome: { sidenav: pagesView.ref, activity: false, status: syncView.ref },
  regionSettings: {
    sidenav: { size: { defaultPx: 240, minPx: 200, maxPx: 320 }, collapsible: false },
  },
});
```

`chrome` replaces the content of `nav`, `sidenav`, `activity`, or `status` with a declared view while the mode is active. Global panel controls live in host chrome: the web navigation header or the desktop title bar. They remain available beside custom navigation content. Use `false` to hide a chrome region. Omit a key to retain its normal host content. These views share the normal webview capability boundary and receive the active `pageLocation` in their props. Include navigation back to the project when replacing host navigation.

`regionSettings.sidenav` controls a custom sidebar even without a placement. Declare page content through `main` and optional `slots`. Region settings inherit the host defaults per property.

During a tab drag, only the hovered valid panel shows a faint overlay across its whole container without shifting its content. The overlay covers padding and header controls in attached and floating panels. Tab insertion keeps the shared Sidenav placement indicator.

Main headers follow the page's tab policy. A page with `main.presentation: "page"` has no header; a tabbed page has a header. Saved header choices do not override that rule. There is no Show header or Hide header action. Legacy auxiliary header defaults and the programmatic setter remain accepted for existing integrations until their coordinated removal.

## User arrangement

A declared region is the starting position. Users can move content tabs between Main, Side, and Secondary with drag and drop or the tab context menu. Every content tab can move to every available tab panel. A tool's Add choices do not restrict its open tab. Navigation chrome and the Sidenav do not become tabs.

The + control follows the scrolling tab group. Its choices create or reopen tools allowed in that destination. An open singleton is omitted from every panel's choices. Resource bindings appear only when they declare an explicit `add` action; the current page resource never creates an individual-resource choice. Open existing resources through navigation or resource search. Panel menu openers stay at the far right.

An empty Main, Side, or Bottom panel without a custom placeholder shows a card grid without a heading of the same available tabs as **Add panel**. The grid uses two columns in a wide panel and one in a narrow panel. Cards share hover, pressed, and keyboard focus states. Page-owned `slots`, including bindings with command-backed Add actions, contribute entries through that same contract. Choosing a card uses the same opening action and permissions. Page slots and mode placements can declare `addableIn` to restrict only the panels whose Add menu and default placeholder offer them. Tab movement, explicit navigation, and restored positions stay independent. The deprecated `movableTo` field is accepted as an alias for `addableIn` when the latter is omitted; it never restricts movement. Navigating to a page again reopens its declared Main content.

Either kind of page can declare `main.empty: view.ref` instead of the host placeholder. To supply a breadcrumb label and menu while Main has no tabs, use the `PagePlaceholder` object form:

```ts
main: {
  kind: "panels",
  empty: {
    view: createView.ref,
    breadcrumb: {
      label: "New item",
      menu: [{
        id: "items",
        rows: [{ id: "browse", label: "Browse items", action: { kind: "page", page: itemsPage.ref } }],
      }],
    },
  },
},
```

`pagePlaceholderView(main.empty)` returns the view ref from either form. The placeholder's breadcrumb applies only to the current page while Main is empty. Ancestor crumbs keep their page titles. Opening content restores the normal breadcrumb presentation. The view and its actions belong to the page; a placeholder does not create a tab or a placement identity. The host adds no recovery buttons. A panel collection may name a static Main slot or an independent static placement with `main.landing`; collection breadcrumbs and navigation open it. An independent landing must belong to the same mode. Navigation selects it wherever the user placed it. The `workbench.reopenPageContent` and `workbench.resetLayout` commands remain available independently of the placeholder.

Explicit collection navigation selects its available landing slot. Restoring saved page state preserves the saved selection.

Page header defaults, optional `main.empty` on single-view pages, `main.landing`, slot and placement `addableIn`, and closable fixed tabs describe APIs from `main`. Their first extension API version is 0.2.2.

During the deprecation window, older extension collections keep their first `fixed` Main slot as their landing slot. New declarations should name `main.landing` explicitly.

Default tab cards wait until a declared mode has been selected, so startup never presents unrelated tools before the page resolves.

Tool cards use the compact action-card style: small body padding, the standard row label, and a 14 px icon, matching the density of Home's Recent rows. Hover entry and exit are immediate. The chooser is top-aligned with `xl` panel padding, centered horizontally, and capped at the `lg` size token. Narrow panels use the available width and collapse to one column.

Start uses its home content as a tabless Main view. Its Main header defaults to hidden. A saved user header choice still wins. Main does not accept dropped tabs on this page.

A resource-free panel collection and its tabbed detail pages share one Main tab tray. The page hierarchy defines the collection through `parentId`; resource-bearing parents and different modes keep separate trays. A detail page can use `main: { kind: "panels", landing: viewer.ref }` to open its routed resource through an independent viewer. That binding must accept the page's resource kinds, use `cardinality: "many"`, and start in Main. A landing placement must map each resource to one unambiguous page route. Returning to the collection restores its other tabs, tools, order and selection. Entries now owned by auxiliary viewers are retired from the saved Main tray. Header choices remain scoped to each page.

Sessions uses a tabless Main view. Its root opens the new-session composer, whose tab presentation supplies the current breadcrumb label and menu. A resource or draft replaces Main content. Its independent Session panel view offers new drafts and can switch its own resource. Creating from a routed Main draft opens `workbenchPages.session`; creating in a panel replaces that actual viewer. Late completion cannot reopen a source that has closed, switched, or left its project. Tickets uses a tabless board with an independent browser panel view. Timeline is tabless without a panel view. Artifacts keeps a tabbed collection with a singleton library browser and independent resource viewers.

Right-click, Shift+F10, the Context Menu key, and touch long-press open the same grouped tab menu. Normal clicks select. Preview and pinned tabs can appear in any order. Pin and Unpin change retention without changing position. Alt+Left and Alt+Right reorder the focused tab.

Resource tabs begin with the same resource-owned action group as navigation and breadcrumbs. A placement's `tab` query adds independent custom groups, such as the Sessions controls. Each group has `rows` and can have a localized `label`. Session switching opens a separate resource search modal. Shared Tab controls follow these groups. Keep resource operations in resource menu slots so they are available on every surface.

Placement identity and ownership stay the same when a tab moves. Mode arrangements persist within the project and mode; page arrangements persist within the page location. Reset layout restores the active page and shared mode defaults without deleting session or terminal data or clearing other page locations.

Main views declare `presentation: "page"` to show one page or resource without tabs. This is independent of resource `cardinality` and header visibility. Main then has no Add, Close, Pin, reorder, or drop target. Navigation replaces its content. Extra Main slots are invalid. Side and Secondary keep normal tabs and their mode permissions.

Omitting `presentation`, or using `presentation: "tabs"`, keeps normal Main tabs. A panel collection also keeps tabs. Every content tab can move to every available tab panel, but a Main showing page content cannot accept one. Showing its header does not change that rule.

Page content has its own lifetime outside the tab layout. It still participates in resource identity, focus, and view context. A resource page can declare `main.empty` for its landing state. When an existing page changes to page presentation, its obsolete saved Main tray is retired; independent panel layouts and page header choices are preserved. A page boundary never inherits an ancestor collection's Main tabs.

## Panel views

A page may name its independent panel version with `panelView: browser.ref`. Declare that panel with `definePlacement`. A static item is a resource browser; a resource binding is a resource viewer. Both use the normal Add menu and card chooser, instance rules, drag behavior, and close/pin actions. The panel can reuse the page's ViewRef or use another renderer. Its lifetime belongs to the mode, so navigating Main does not close it.

```ts
const browser = definePlacement({
  id: "board-browser",
  mode: workbenchModes.project,
  region: "side",
  item: { kind: "view", view: boardView.ref, presence: "closed" },
});
const board = definePage({
  id: "board",
  title: "Board",
  path: "board",
  mode: workbenchModes.project,
  main: { kind: "view", view: boardView.ref, cardinality: "one", presentation: "page" },
  panelView: browser.ref,
  slots: [],
});
```

Include both declarations in the extension's `pages` and `placements` arrays. An open static browser is a singleton and disappears from Add choices in every panel. A binding needs an explicit `add` action to appear there. Old Main views moved to auxiliary panels migrate to the declared panel version when their page becomes tabless. Pages without a panel version retire their obsolete page tabs; this does not delete their resources or drafts.

Main offers a page-associated panel only within that page's collection, including panels whose default region is Side or Bottom. Auxiliary choosers keep mode-wide choices. These creation rules do not restrict dragging an existing tab. A resource page whose `main.landing` names a many-resource binding accepts `open: "pin"` and `open: "preview"`, using that binding's normal retention rules.

A placement can declare `replaces: [previousPageSlot]` when moving an extension's public page slot to an independent owner. Old links resolve to the new placement. Saved tabs migrate in place, retaining their region, selection, and retention. Each previous slot has one replacement, owned by the same extension. Keep the old public ref exported with `@deprecated` and name the new placement ref.

Static tools and single-resource tabs support the same Pin tab and Unpin tab actions as resource previews. Static tabs start pinned. Unpinning makes a normal preview that can be replaced or closed on page leave. Retention is stored in the existing layout, independently of the declaration that creates the content.

Resource links open in Main. If the same resource is already open in this project and mode, Workbench selects and reveals its viewer instead. This includes inactive tabs and collapsed panels. A browser's selected row and an automatic `openOn: "page-resource"` context follower do not own independent viewers. Document identity includes the metadata key declared by `page.document`.

A viewer switches its own resource with a caller-relative navigation target:

```ts
await host.navigation.open({
  kind: "viewer",
  operation: "switch",
  from: props.resource,
  resource: nextResource,
});
```

The host captures the calling placement. Extensions cannot choose another viewer's identity. If `from` is no longer displayed there, the request has no effect. Switching to a resource open elsewhere focuses that viewer and leaves the caller unchanged. Use `operation: "replace"` after creating a resource from a draft. It replaces the draft in its actual panel and preserves focus when the draft is inactive. A current Main draft can also provide a compatible `page` ref for the created resource. A resource-free Main landing can omit `from` for a switch or replacement and must provide the destination `page`; its caller must still be the current page content.

Page and viewer targets accept a heading `section` or source `position`. These belong to the selected viewer. Webviews receive them as `props.viewLocation`. Its `pageContext` retains the viewer's page, parent resource hierarchy, and parameters when opened through page navigation. Selecting a retained Main resource tab restores that context. `props.pageLocation` continues to describe Main. Auxiliary switches never rewrite Main's URL, breadcrumbs, or navigation memory. A panel view dragged into another tabbed page stays in that page; it does not activate its tabless page version.

Closing a selected collection viewer follows the next resource tab. If no routed viewer remains selected, Main returns to the collection's parent location without reopening a closed browser. Creation and switch callbacks stay in their captured project. The host captures the deletion version before an asynchronous command. A later deletion invalidates that older result; a fresh action can still open a recreated resource with the same identity. Native integrations can use `workbench.viewers.capture(identity)` for the same guarded handoff.

Navigation items can use `intent: "restore"` on a page target to return to the last location within that page and ancestor resource context. Restoration does not reserve a resource. If an auxiliary viewer now owns it, Main returns to its landing state and consumes that remembered resource location. Deleting a resource also clears its navigation references. Explicit resource links still focus an existing viewer.

Live views stay mounted during tab selection and page navigation. Iframe state also survives explicit moves in browsers with the DOM `moveBefore` API. See [ADR 0053](../../adrs/0053-temporary-webview-move-fallback.md) for the temporary WebKit limit.

## Panel policy

Each permission is independent. The active mode owns the policy; the saved mode layout owns panel visibility and geometry. Header choices belong to each page layout. Main always remains available as page context. Side and Bottom remain global within the mode.

| Region setting | Behavior |
| --- | --- |
| `canOpen` | Allows revealing a closed panel. Existing open panels remain usable when false. |
| `canClose` | Allows hiding a panel. Closing individual tabs stays independent. A nonclosing surface remains visible after its last tab closes. |
| `acceptsTabs` | Allows new tabs and drops, including moves. Existing tabs remain usable. |
| `movable` | Allows moving the whole panel or action bar. Tab acceptance remains independent. Main and Bottom must both allow movement to flip their order. |
| `resizable` | Allows pointer, keyboard and command resizing. Equal minimum and maximum sizes also prevent resizing. |
| `floatable` | Side only. Allows floating, independently of visibility. Overrides `floatingPanels`. |

These optional booleans default to true. Unavailable panels reject opening and drops, and stale layouts cannot restore them. Commands validate before publishing navigation. Disallowed controls are omitted. A directional Show or Hide action requires its corresponding permission; a toggle requires both. Tab movement follows the destination panel's availability and `acceptsTabs` policy; Add choices never restrict an existing tab. Side moves left or right of Main. Navigation moves to the far left or right. Main and Bottom can flip their vertical order. The action bar supports all four outer edges. Placement choices persist per project and mode; Reset layout clears them. A mode that disables movement restores that region to its default position.

`floatingPanels` is deprecated in favor of `regionSettings.side.floatable`. Panel `collapsible` is deprecated in favor of `canOpen`/`canClose`; it keeps its legacy drag-collapse behavior, including explicit Show/Hide, when new permissions are omitted. Panel menus still support `collapsible`. Publish this additive SDK and host release before adopting the new fields in separately released extensions.

Main headers follow `main.presentation`: tabless pages have no header, and tabbed pages have a header. Header menus do not offer Show or Hide header. Auxiliary header defaults come from the mode's `regionSettings`. The same rules apply to host and extension pages.

Optional panels still collapse when their final tab closes or moves away. An explicit empty-panel open does not exempt a later final-tab close. Related placement, manual closure and revisit keep the [related-opening rules](0019-related-resource-openings.md). No page Side/Bottom layer or page panel snapshots are added.

Declare `floatingPanels: "hidden"` on the mode to prevent floating side panels. The controller attaches an open floating panel when entering the mode and leaves a closed panel closed. Floating requests and restored state obey the same policy. The default is `"visible"`. Placements and page slots do not control floating.

`regionSettings[region].collapsible: false` prevents dragging the region closed. The shared navigation buttons can still hide and reopen it. Hiding preserves its placements. Docked content stays mounted through hide and reopen. It does not close a tab or change the page.

`alwaysShowTabs` is deprecated. Use `main.presentation` to choose page-owned content or a tabbed Main panel, and `showHeader` to show or hide a tab tray. Until its removal, `alwaysShowTabs: false` hides the tab tray when `showHeader` is omitted. Tab support does not affect panel visibility or floating permission.

The host's Project mode and the workbench's [showcase examples](../../../packages/pstdio-workbench/src/examples/showcases/showcases.stories.tsx) use these policies:

| Mode | Panel policy |
| --- | --- |
| Project | Session and terminal regions keep single tabs. Side panels may float. |
| Kiln (animation editor) | Floating disabled. Inspector and timeline cannot be dragged closed. Both have navigation visibility buttons. |
| Boombox (music player) | Fixed-height transport cannot be dragged closed. Its navigation visibility button preserves the player. |
| Pigeon, Zipline | Side panels may float, attach, hide, and reopen. Sidebar sizes belong to the mode. |
| Scribble | Custom sidebar keeps its mode size and disables drag collapse. |

Host modes and extension modes use the same settings.
