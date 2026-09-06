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

`chrome` replaces the whole `nav`, `sidenav`, `activity`, or `status` region with a declared view while the mode is active. Use `false` to hide a region. Omit a key to retain its normal host content. These views share the normal webview capability boundary and receive the active `pageLocation` in their props. Include navigation back to the project when replacing host navigation.

`regionSettings.sidenav` controls a custom sidebar even without a placement. Page-owned content still belongs in `slots`. A side slot with `floatingPanels: "hidden"` displays in the attached host; side sizing and collapsibility follow the mode.

Set `regionSettings.secondary.showHeader: false` for a player or timeline that supplies its own controls. This removes the docked panel's tab and Add header without changing its content. Main and attached Side panels support the same setting. Floating panels retain their window controls.
