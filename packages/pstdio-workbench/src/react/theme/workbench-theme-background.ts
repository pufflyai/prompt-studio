import type { WorkbenchRegion } from "../../core";

const chakraBackgrounds = {
  activityBar: "var(--chakra-colors-bg-muted)",
  sideBar: "var(--chakra-colors-bg-subtle)",
  main: "var(--chakra-colors-bg)",
  panel: "var(--chakra-colors-bg-panel)",
  statusBar: "var(--chakra-colors-bg-subtle)",
} as const;

const vscodeColor = (token: string, fallback: string) =>
  `var(--chakra-colors-vscode-${token.replaceAll(".", "-")}, ${fallback})`;

export const workbenchBackgrounds = {
  activityBar: vscodeColor("activityBar.background", vscodeColor("sideBar.background", chakraBackgrounds.activityBar)),
  sideBar: vscodeColor("sideBar.background", chakraBackgrounds.sideBar),
  main: vscodeColor("editor.background", chakraBackgrounds.main),
  panel: vscodeColor("panel.background", chakraBackgrounds.panel),
  statusBar: vscodeColor("statusBar.background", vscodeColor("sideBar.background", chakraBackgrounds.statusBar)),
  widget: vscodeColor("editorWidget.background", vscodeColor("panel.background", chakraBackgrounds.panel)),
} as const;

const workbenchRegionBackgrounds = {
  nav: workbenchBackgrounds.main,
  activity: workbenchBackgrounds.activityBar,
  "sidebar-header": workbenchBackgrounds.sideBar,
  sidebar: workbenchBackgrounds.sideBar,
  "main-header": workbenchBackgrounds.main,
  "main-left-menu": workbenchBackgrounds.panel,
  main: workbenchBackgrounds.main,
  "main-right-menu": workbenchBackgrounds.panel,
  "secondary-header": workbenchBackgrounds.panel,
  "secondary-left-menu": workbenchBackgrounds.panel,
  secondary: workbenchBackgrounds.panel,
  "secondary-right-menu": workbenchBackgrounds.panel,
  status: workbenchBackgrounds.statusBar,
  overlay: workbenchBackgrounds.widget,
  "side-header": workbenchBackgrounds.widget,
  "side-left-menu": workbenchBackgrounds.widget,
  side: workbenchBackgrounds.widget,
  "side-right-menu": workbenchBackgrounds.widget,
} as const satisfies Record<WorkbenchRegion, string>;

export const workbenchFocusBorder = vscodeColor("focusBorder", "var(--chakra-colors-color-palette-focus-ring)");

export const workbenchCommandPaletteBackground = workbenchBackgrounds.widget;

export const getWorkbenchRegionBackground = (region: WorkbenchRegion) => workbenchRegionBackgrounds[region];
