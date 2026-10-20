# Modes and layout

A mode is a workbench context with its own docked regions, chrome, and theme. This page covers modes, mode placements, chrome, and region settings.

By default, opening a page selects its declared mode. Pages can also declare the modes in which they are available.

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

Use `definePage` for routed content. Do not model a page as a mode placement, and do not switch a mode as a separate navigation step. A page target validates and activates its page and mode as one transaction.

Mode and page placements are additive. If both use `side`, both appear. Main tabs belong to the page. Pinned tabs moved into Side or Bottom remain shared across pages within the mode. Unpinned tabs close on page leave. User open state stays within its project and mode.

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

`regionSettings.sidenav` controls a custom sidebar even without a placement. Page-owned content still belongs in `slots`. Region settings inherit the host defaults per property. For example, setting `alwaysShowTabs` preserves the host's size unless the mode supplies its own `size`.

Set `regionSettings.secondary.showHeader: false` for a player or timeline that supplies its own controls. A panel without tabs stays headerless. During a tab drag, only the hovered valid panel shows a faint overlay across its whole container without shifting its content. The overlay covers padding and header controls in attached and floating panels. Dropping another tab there reveals the shared tray. Main, Side, and Secondary use the same rule. Tab insertion keeps the shared Sidenav placement indicator.

## User arrangement

A declared region is the starting position. Users can move content tabs between Main, Side, and Secondary with drag and drop or the tab context menu. Explicit `movableTo` restrictions and the mode's supported panels remain hard limits. Navigation chrome and the Sidenav do not become tabs.

The + control follows the scrolling tab group. Its choices include active panels from other regions that are allowed in this destination. A single-instance panel is reused. Resource bindings retain their declared Add action. Panel menu openers stay at the far right.

Right-click, Shift+F10, the Context Menu key, and touch long-press open the same grouped tab menu. Normal clicks select. Preview and pinned tabs can appear in any order. Pin and Unpin change retention without changing position. Alt+Left and Alt+Right reorder the focused tab.

Resource tabs begin with the same resource-owned action group as navigation and breadcrumbs. A placement's `tab` query adds independent custom groups, such as the Sessions controls. Each group has `rows` and can have a localized `label`. Session switching opens a separate resource search modal. Shared Tab controls follow these groups. Keep resource operations in resource menu slots so they are available on every surface.

Placement identity and ownership stay the same when a tab moves. Mode arrangements persist within the project and mode; page arrangements persist within the page location. Reset layout restores the active page and shared mode defaults without deleting session or terminal data or clearing other page locations.

A moved view keeps its tab tray even when it is the only view in its destination. This keeps the move and reset actions available. Returning it to its declared region restores that region's normal header policy. Page-owned Locations and their Sub Panels keep their owner lifecycle when they share a region with other scoped content. Primary changes reconcile each placement separately.

Live views stay mounted during tab selection and page navigation. Iframe state also survives explicit moves in browsers with the DOM `moveBefore` API. See [ADR 0053](../../adrs/0053-temporary-webview-move-fallback.md) for the temporary WebKit limit.

## Panel policy

Each permission is independent. The active mode owns the policy; the saved mode layout owns visibility and header choices. Main always remains available as page context. Side and Bottom remain global within the mode.

| Region setting | Behavior |
| --- | --- |
| `canOpen` | Allows revealing a closed panel. Existing open panels remain usable when false. |
| `canClose` | Allows hiding a panel. Closing individual tabs stays independent. A nonclosing surface remains visible after its last tab closes. |
| `acceptsTabs` | Allows new tabs and drops, including moves. Existing tabs remain usable. |
| `resizable` | Allows pointer, keyboard and command resizing. Equal minimum and maximum sizes also prevent resizing. |
| `floatable` | Side only. Allows floating, independently of visibility. Overrides `floatingPanels`. |

These optional booleans default to true. Unavailable panels reject opening and drops, and stale layouts cannot restore them. Commands validate before publishing navigation. Disallowed controls are omitted. A directional Show or Hide action requires its corresponding permission; a toggle requires both. Tab movement still respects published `movableTo` restrictions. Whole-panel docking is separate work.

`floatingPanels` is deprecated in favor of `regionSettings.side.floatable`. Panel `collapsible` is deprecated in favor of `canOpen`/`canClose`; it keeps its legacy drag-collapse behavior, including explicit Show/Hide, when new permissions are omitted. Panel menus still support `collapsible`. Publish this additive SDK and host release before adopting the new fields in separately released extensions.

Right-click a header, press Shift+F10 or the Context Menu key while it has focus, or touch and hold to hide it. Its hidden top edge offers the same ways to show it. Header choices persist in the mode layout and reset with layout reset. Showing a header grants no other permission. The host treats explicit `showHeader` as authoritative. Auxiliary trays show a lone tab by default. Main keeps the single-resource view rule: no implicit tab strip or close action. Published extension declarations keep their existing implicit header and single-tab rules until the coordinated breaking release, even when they use the new permissions. An explicit user header choice overrides those defaults.

Optional panels still collapse when their final tab closes or moves away. An explicit empty-panel open does not exempt a later final-tab close. Related placement, manual closure and revisit keep the [related-opening rules](0019-related-resource-openings.md). No page Side/Bottom layer or page panel snapshots are added.

Declare `floatingPanels: "hidden"` on the mode to prevent floating side panels. The controller attaches an open floating panel when entering the mode and leaves a closed panel closed. Floating requests and restored state obey the same policy. The default is `"visible"`. Placements and page slots do not control floating.

`regionSettings[region].collapsible: false` prevents dragging the region closed. The shared navigation buttons can still hide and reopen it. Hiding preserves its placements. Docked content stays mounted through hide and reopen. It does not close a tab or change the page.

A lone closable panel keeps its tab visible by default. `alwaysShowTabs: true` shows every lone tab; `false` hides a lone tab in its declared region. Multiple visible items and moved views always show tabs. Tab visibility does not affect panel visibility or floating permission.

The host's Project mode and the workbench's [showcase examples](../../../packages/pstdio-workbench/src/examples/showcases/showcases.stories.tsx) use these policies:

| Mode | Panel policy |
| --- | --- |
| Project | Session and terminal regions keep single tabs. Side panels may float. |
| Kiln (animation editor) | Floating disabled. Inspector and timeline cannot be dragged closed. Both have navigation visibility buttons and hide single tabs. |
| Boombox (music player) | Fixed-height transport cannot be dragged closed. Its navigation visibility button preserves the player. |
| Pigeon, Zipline | Side panels may float, attach, hide, and reopen. Sidebar sizes belong to the mode. |
| Scribble | Custom sidebar keeps its mode size and disables drag collapse. |

Host modes and extension modes use the same settings.

## Page availability and mode history

On `main` (extension API 0.2.1), a page can declare `modes: [mode.ref, otherMode.ref]`. The list must be non-empty, unique, and include its existing `mode` default. Without `modes`, opening the page keeps the established behavior of selecting its declared mode. With `modes`, an ordinary link keeps the current mode when supported, otherwise switches to the page's default `mode`. An explicit navigation `mode` must be supported; invalid page/mode pairs fail before navigation changes state. Extension authors do not need to duplicate these checks in ordinary buttons.

A mode can declare `basePage: page.ref`. Switching modes restores that mode's last allowed page, or its base page when the saved page is unavailable. The base page must support the mode. Navigation trees, resource search, direct opens and URLs without a mode use the same mode selection rule. An ordinary cross-mode link remains usable. Reload and Back/Forward validate their captured mode; they never silently replace an explicitly requested mode. Page locations and copied URLs retain the selected mode; `_mode` is the URL transport key, separate from page parameters such as `mode`.

## Unique resource editors

On `main` (extension API 0.2.1), a view can declare `instancePolicy: "per-resource"`. One editor then owns each full resource identity for that view within a project and mode. Different extensions, projects, resource kinds and declared documents remain distinct. This policy is independent of binding `cardinality`, which controls how many resources one binding holds. Omitting the policy, or choosing `"multiple"`, preserves placement-based behavior.

Explicit opening, including Add panel, selects the existing editor in Main, Side or Bottom. New resources open in the chosen tray. Its mounted view, unsaved content, tray and retention remain intact. Reopening an editor in Side or Bottom leaves the current Main page and browser history unchanged. A hidden Main editor returns with its owning page. Its page Main snapshot captures that route and its ancestry together with the tray. Navigation, restore and layout reset use the same identity rules.

Moving the final routed Main document to another tray returns Main to its contextual parent or collection. The moved editor keeps its resource binding. Automatic related previews do not trigger this fallback. A moved editor follows its tray's project/mode lifetime rather than inheriting its source page's availability restriction.

Publish the SDK and host before separately released extensions adopt these fields.
