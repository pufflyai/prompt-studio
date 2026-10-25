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

`regionSettings.sidenav` controls a custom sidebar even without a placement. Page-owned content still belongs in `slots`. Region settings inherit the host defaults per property. For example, setting `showHeader` preserves the host's size unless the mode supplies its own `size`.

Set `regionSettings.secondary.showHeader: false` for a player or timeline that supplies its own controls. During a tab drag, only the hovered valid panel shows a faint overlay across its whole container without shifting its content. The overlay covers padding and header controls in attached and floating panels. Dropping a tab into a panel with a hidden header restores the header and saves Show header as the user's choice. Cancelled and rejected drops preserve the setting. Main, Side, and Secondary use the same rule. Tab insertion keeps the shared Sidenav placement indicator.

A page can declare `regionSettings: { main: { showHeader: false } }`, or header defaults for `side` and `secondary`. Header visibility resolves as **user > page > mode**, then shown. Page settings only declare header defaults; panel permissions remain with the mode. An omitted page value inherits the mode. Each page layout owns its header choices. Switching pages restores that page's choice or applies its default. A choice on another page never overrides it. Reset layout clears the current page's header choices.

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

`pagePlaceholderView(main.empty)` returns the view ref from either form. The placeholder's breadcrumb applies only to the current page while Main is empty. Ancestor crumbs keep their page titles. Opening a tab restores the normal breadcrumb presentation. The view and its actions belong to the page; a placeholder does not create a tab or a placement identity. The host adds no recovery buttons. A panel collection may name a static Main slot with `main.landing`; collection breadcrumbs and navigation open it. The `workbench.reopenPageContent` and `workbench.resetLayout` commands remain available independently of the placeholder.

Explicit collection navigation selects its available landing slot. Restoring saved page state preserves the saved selection.

Page header defaults, optional `main.empty` on single-view pages, `main.landing`, slot and placement `addableIn`, and closable fixed tabs describe APIs from `main`. Their first extension API version is 0.2.2.

During the deprecation window, older extension collections keep their first `fixed` Main slot as their landing slot. New declarations should name `main.landing` explicitly.

Default tab cards wait until a declared mode has been selected, so startup never presents unrelated tools before the page resolves.

Tool cards use the compact action-card style: small body padding, the standard row label, and a 14 px icon, matching the density of Home's Recent rows. Hover entry and exit are immediate. The chooser is top-aligned with `xl` panel padding, centered horizontally, and capped at the `lg` size token. Narrow panels use the available width and collapse to one column.

Start uses its home content as `main.empty`, with no initial tabs or landing slot. Its Main header defaults to hidden. A saved user header choice still wins, and dropping a tool tab into Main reveals the header through the shared move behavior.

A resource-free panel collection and its detail pages share one Main tab tray. The page hierarchy defines the collection through `parentId`; resource-bearing parents and different modes keep separate trays. Returning to the collection restores its open tabs, tools, order and selection. Header choices remain scoped to each page.

Sessions uses the default card placeholder. Its **New session** tool opens a real tab through an explicit creation action. `workbenchPages.newSession` is the routed draft page at `sessions/new`; it accepts a `session-draft` resource and displays that tab. Creating from a routed Main draft navigates to `workbenchPages.session`. A draft moved into a shared panel becomes one session tab there and preserves the current page. A completed creation does not change navigation after its draft has left the current layout. Closing the final tab restores the default card placeholder.

Right-click, Shift+F10, the Context Menu key, and touch long-press open the same grouped tab menu. Normal clicks select. Preview and pinned tabs can appear in any order. Pin and Unpin change retention without changing position. Alt+Left and Alt+Right reorder the focused tab.

Resource tabs begin with the same resource-owned action group as navigation and breadcrumbs. A placement's `tab` query adds independent custom groups, such as the Sessions controls. Each group has `rows` and can have a localized `label`. Session switching opens a separate resource search modal. Shared Tab controls follow these groups. Keep resource operations in resource menu slots so they are available on every surface.

Placement identity and ownership stay the same when a tab moves. Mode arrangements persist within the project and mode; page arrangements persist within the page location. Reset layout restores the active page and shared mode defaults without deleting session or terminal data or clearing other page locations.

Every view in Main, Side, and Secondary has a tab, including single-resource pages and lone views. The header setting alone decides whether the tray shows. Page-owned Locations and their Sub Panels keep their owner lifecycle when they share a region with other scoped content. Primary changes reconcile each placement separately.

Static tools and single-resource tabs support the same Pin tab and Unpin tab actions as resource previews. Static tabs start pinned. Unpinning makes a normal preview that can be replaced or closed on page leave. Retention is stored in the existing layout, independently of the declaration that creates the content.

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

Right-click a header, press Shift+F10 or the Context Menu key while it has focus, or touch and hold to hide it. Its hidden top edge offers the same ways to show it. Header choices persist per project and page, across that page's resource routes, and reset with layout reset. The choice applies when selected, before another page can become active. Showing a header grants no other permission. The same header and tab rules apply to host and extension pages.

Optional panels still collapse when their final tab closes or moves away. An explicit empty-panel open does not exempt a later final-tab close. Related placement, manual closure and revisit keep the [related-opening rules](0019-related-resource-openings.md). No page Side/Bottom layer or page panel snapshots are added.

Declare `floatingPanels: "hidden"` on the mode to prevent floating side panels. The controller attaches an open floating panel when entering the mode and leaves a closed panel closed. Floating requests and restored state obey the same policy. The default is `"visible"`. Placements and page slots do not control floating.

`regionSettings[region].collapsible: false` prevents dragging the region closed. The shared navigation buttons can still hide and reopen it. Hiding preserves its placements. Docked content stays mounted through hide and reopen. It does not close a tab or change the page.

`alwaysShowTabs` is deprecated. Use `showHeader` to show or hide the tab tray. Until its removal, `alwaysShowTabs: false` hides the tab tray when `showHeader` is omitted. Tab visibility does not affect panel visibility or floating permission.

The host's Project mode and the workbench's [showcase examples](../../../packages/pstdio-workbench/src/examples/showcases/showcases.stories.tsx) use these policies:

| Mode | Panel policy |
| --- | --- |
| Project | Session and terminal regions keep single tabs. Side panels may float. |
| Kiln (animation editor) | Floating disabled. Inspector and timeline cannot be dragged closed. Both have navigation visibility buttons. |
| Boombox (music player) | Fixed-height transport cannot be dragged closed. Its navigation visibility button preserves the player. |
| Pigeon, Zipline | Side panels may float, attach, hide, and reopen. Sidebar sizes belong to the mode. |
| Scribble | Custom sidebar keeps its mode size and disables drag collapse. |

Host modes and extension modes use the same settings.
