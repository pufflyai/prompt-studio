# Extension modes and layout

A mode describes workbench context and the docked regions it supports. A page declares its base mode, so page navigation always selects the correct mode.

Use `definePlacement` only for content that should remain across pages in that mode:

```ts
definePlacement({
  id: "sessions",
  mode: workbenchModes.project,
  item: { kind: "view", view: sessions.ref, presence: "open" },
  region: "side",
});
```

A placement can show a static view or bind a resource kind to a view. A static item declares `presence`: `fixed` (always open, not closable), `open` (open until the user closes it), or `closed` (opened from the Add panel). A binding item declares `cardinality` (`one` rebinds a single instance, `many` opens one instance per resource) and an optional `add` action for the Add panel. A placement may also declare `order` and `movableTo`. Region size and collapsibility belong to the mode's `regionSettings`, not to placements. Region choices are `main`, `secondary`, and `side`; navigation normally belongs in the shared Sidenav tree.

Use `definePage` for routed content. Do not model a page as a mode placement, and do not switch a mode as a separate navigation step. A page target activates the page and its declared mode as one transaction.

Mode and page placements are additive. If both use `side`, both appear. Leaving the page removes only the page placement. User open state is stored against the complete owner identity and cannot leak into another page or mode.

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

`chrome` replaces the content of `nav`, `sidenav`, `activity`, or `status` with a declared view while the mode is active. Custom `nav` keeps the shared panel visibility buttons beside the view. Use `false` to hide a chrome region. Omit a key to retain its normal host content. These views share the normal webview capability boundary and receive the active `pageLocation` in their props. Include navigation back to the project when replacing host navigation.

`regionSettings.sidenav` controls a custom sidebar even without a placement. Page-owned content still belongs in `slots`. Region settings inherit the host defaults per property. For example, setting `alwaysShowTabs` preserves the host's size unless the mode supplies its own `size`.

Set `regionSettings.secondary.showHeader: false` for a player or timeline that supplies its own controls. A panel without tabs stays headerless. During a tab drag, only the hovered valid panel shows a faint overlay across its whole container without shifting its content. The overlay covers padding and header controls in attached and floating panels. Dropping another tab there reveals the shared tray. Main, Side, and Secondary use the same rule. Tab insertion keeps the shared Sidenav placement indicator.

## User arrangement

A declared region is the starting position. Users can move content tabs between Main, Side, and Secondary with drag and drop or the tab context menu. Explicit `movableTo` restrictions and the mode's supported panels remain hard limits. Navigation chrome and the Sidenav do not become tabs.

The + control follows the scrolling tab group. Its choices include active panels from other regions that are allowed in this destination. A single-instance panel is reused. Resource bindings retain their declared Add action. Panel menu openers stay at the far right.

Right-click, Shift+F10, the Context Menu key, and touch long-press open the same grouped tab menu. Normal clicks select. Preview and pinned tabs can appear in any order. Pin and Unpin change retention without changing position. Alt+Left and Alt+Right reorder the focused tab.

Placement identity and ownership stay the same when a tab moves. Mode arrangements persist within the project and mode; page arrangements persist within the page location. Reset layout restores the active page and shared mode defaults without deleting session or terminal data or clearing other page locations.

A moved view keeps its tab tray even when it is the only view in its destination. This keeps the move and reset actions available. Returning it to its declared region restores that region's normal header policy. Page-owned Locations and their Sub Panels keep their owner lifecycle when they share a region with other scoped content. Primary changes reconcile each placement separately.

Live views stay mounted during tab selection and page navigation. Iframe state also survives explicit moves in browsers with the DOM `moveBefore` API. See [ADR 0053](../../adrs/0053-temporary-webview-move-fallback.md) for the temporary WebKit limit.

## Panel policy

Declare `floatingPanels: "hidden"` on the mode to prevent floating side panels. The controller attaches an open floating panel when entering the mode and leaves a closed panel closed. Floating requests and restored state obey the same policy. The default is `"visible"`. Placements and page slots do not control floating.

`regionSettings[region].collapsible: false` prevents dragging the region closed. The shared navigation buttons can still hide and reopen it. Hiding preserves its placements. Docked content stays mounted through hide and reopen. It does not close a tab or change the page.

A lone closable panel keeps its tab visible by default. `alwaysShowTabs: true` shows every lone tab; `false` hides a lone tab in its declared region. Multiple visible items and moved views always show tabs. Tab visibility does not affect panel visibility or floating permission.

| Mode | Panel policy |
| --- | --- |
| Project | Session and terminal regions keep single tabs. Side panels may float. |
| Kiln | Floating disabled. Inspector and timeline cannot be dragged closed. Both have navigation visibility buttons and hide single tabs. |
| Boombox | Fixed-height transport cannot be dragged closed. Its navigation visibility button preserves the player. |
| Pigeon, Zipline | Side panels may float, attach, hide, and reopen. Sidebar sizes belong to the mode. |
| Scribble | Custom sidebar keeps its mode size and disables drag collapse. |

Core callers and SDK extensions use these same settings. Storybook may register modes directly with the workbench; the SDK metadata adapter feeds that same registry and controller.
