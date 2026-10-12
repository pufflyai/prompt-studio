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

Page `regionSettings.bottom` controls a separate bottom panel inside Main. It accepts `size`, `showHeader`, `alwaysShowTabs`, `canOpen`, `canClose`, `acceptsTabs`, `resizable`, `movable`, and `defaultTab`. The deprecated `collapsible` field remains supported. Mode region membership does not enable or disable this page panel. A page bottom is not a mode placement destination. Page `panelMenus` declare the left and right headerless menus and their own size and collapse settings; see [Workbench composition](0008-contextual-workbench-composition.md#page-panels-and-menus).

Set `regionSettings.secondary.showHeader: false` for a player or timeline that supplies its own controls. During the additive extension release, visible tabs can still reveal that header. Host modes keep the authored header hidden until the user chooses Show header. During a tab drag, only the hovered valid panel shows a faint overlay across its whole container without shifting its content. The overlay covers padding and header controls in attached and floating panels. Tab insertion keeps the shared Sidenav placement indicator.

## User arrangement

A declared region is the starting position. Users can move content tabs between Main, Side, and Secondary with drag and drop or the tab context menu. Explicit `movableTo` restrictions and the mode's supported panels remain hard limits. Navigation chrome and the Sidenav do not become tabs.

The + control follows the scrolling tab group. Its choices include active panels from other regions that are allowed in this destination. A single-instance panel is reused. Resource bindings retain their declared Add action. Panel menu openers stay at the far right.

Right-click, Shift+F10, the Context Menu key, and touch long-press open the same grouped tab menu. Normal clicks select. Preview and pinned tabs can appear in any order. Pin and Unpin change retention without changing position. Alt+Left and Alt+Right reorder the focused tab.

Tab identity and resource binding stay the same when a tab moves. Crossing between a page panel and a mode panel transfers ownership to the destination. Mode arrangements persist within the project and mode; page arrangements persist within the page location. Reset layout restores the active page and shared mode defaults without deleting session or terminal data or clearing other page locations.

During the additive release, extension modes keep a moved view’s tab tray even when it is the only view in its destination. This keeps the move and reset actions available. Returning it to its declared region restores that region's normal header policy. Page-owned Locations and their Sub Panels keep their owner lifecycle when they share a region with other scoped content. Primary changes reconcile each placement separately.

Live views stay mounted during tab selection and page navigation. Iframe state also survives explicit moves in browsers with the DOM `moveBefore` API. See [ADR 0053](../../adrs/0053-temporary-webview-move-fallback.md) for the temporary WebKit limit.

## Panel policy

Each permission is independent. Omitted permissions allow the action for a provided panel. An omitted mode region is unavailable. Main retains its page fallback. Page bottom belongs to the page and does not depend on the mode’s optional regions.

| Setting | Rule |
| --- | --- |
| `canOpen` | Allows opening or revealing a closed panel. |
| `canClose` | Allows hiding a panel without closing its tabs. Toggle requires both visibility permissions. |
| `acceptsTabs` | Allows new and moved tabs. Existing tabs can still be selected. |
| `resizable` | Allows resizing within `size.minPx` and `size.maxPx`. Equal bounds leave no resize range. |
| `movable` | Controls whole-panel placement, separately from tab movement and resize permission. |
| `floatable` | Allows floating Side. Other panels do not float. |
| `defaultTab` | Serializable navigation target, resolved once when directly opening an empty panel. |

For a fixed visible panel, declare `canOpen: false` and `canClose: false` in an authored open layout. Disallowed controls are absent. The palette, keyboard commands, navigation, and drops use the same rules. Showing a header grants no permission. Tab movement still follows the placement’s `movableTo` restrictions.

`collapsible` is deprecated for tab panels in favor of `canOpen` and `canClose`. Old `collapsible: false` declarations still prevent drag collapse while allowing explicit Show and Hide. Page panel menus retain their own collapse settings.

`floatingPanels` is deprecated in favor of `regionSettings.side.floatable`. Existing declarations retain their attached fallback when floating is hidden. New `floatable: false` declarations reject floating requests. Mode `floatingBubble` controls bubble availability; it grants no open or floating permission. `floating.defaultTab` supplies the empty-panel default for a direct floating open. Retained tabs take precedence.

## Empty panels and headers

The host saves `auto`, `open`, or `closed` intent in the owning panel record. Automatic empty panels close. Direct Open or Show records `open`, including when the panel is already visible, and keeps an empty drop surface. Hide records `closed` and retains tabs. Page-bottom choices belong to the page instance; Side and Secondary choices belong to the project and mode.

An empty-panel `defaultTab` runs only on direct panel open. Navigation, drops, restore, and reset do not create defaults. Repeated opens reuse retained tabs and share any pending creation for that owner. The default follows normal navigation permissions.

A later Close stays effective when that creation finishes. A later explicit navigation or tab move can reveal the panel again. Extension commands return navigation requests as usual; the host keeps those requests linked to the default execution. Native workbench command handlers use `context?.navigation ?? workbench.navigation` for navigation created by their execution, including after an `await`. The fallback supports ordinary command calls that have no execution context. Direct `workbench.navigation` calls remain explicit actions. This keeps creation separate from newer user actions without holding an asynchronous global scope.

Host mode headers are visible by default and show a single fixed tab. `showHeader: false` hides the header until the user chooses Show header. The panel’s top edge offers that action through right-click, Shift+F10, the Context Menu key, or touch hold. Visible headers offer Hide header in their options menu and tab context menu. The saved header choice belongs to the panel owner. Page panel menus have no headers.

During the additive extension release, the host adapter preserves existing extension header and tab behavior, even when new permission fields are used: tabs may override an authored hidden header, and a lone fixed tab may remain headerless. `alwaysShowTabs` retains its old meaning. The authoritative authored-header behavior applies to host stories first; the extension cutover requires the coordinated breaking release described in [API versioning](0014-api-versioning.md). An explicit user header choice applies to that owner.

The host showcases declare their choices explicitly. Boombox has no navigation panel or bubble; Player stays fixed at the bottom and Up next is a locked Side tab. Kiln’s Inspector stays visible and can resize; Timeline stays fixed and starts with a hidden header that can be shown.
