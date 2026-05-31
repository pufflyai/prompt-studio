import type { WorkbenchArea } from "../../core";

const chakraBackgrounds = {
  activityBar: "var(--chakra-colors-bg-muted)",
  sideBar: "var(--chakra-colors-bg-subtle)",
  main: "var(--chakra-colors-bg)",
  panel: "var(--chakra-colors-bg-panel)",
  statusBar: "var(--chakra-colors-bg-muted)",
} as const;

const vscodeColor = (token: string, fallback: string) =>
  `var(--chakra-colors-vscode-${token.replaceAll(".", "-")}, ${fallback})`;

export const workbenchBackgrounds = {
  activityBar: vscodeColor("activityBar.background", vscodeColor("sideBar.background", chakraBackgrounds.activityBar)),
  sideBar: vscodeColor("sideBar.background", chakraBackgrounds.sideBar),
  main: vscodeColor("editor.background", chakraBackgrounds.main),
  panel: vscodeColor("panel.background", chakraBackgrounds.panel),
  statusBar: vscodeColor(
    "statusBar.background",
    vscodeColor("activityBar.background", vscodeColor("sideBar.background", chakraBackgrounds.statusBar)),
  ),
  widget: vscodeColor("editorWidget.background", vscodeColor("panel.background", chakraBackgrounds.panel)),
} as const;

const workbenchAreaBackgrounds = {
  nav: workbenchBackgrounds.main,
  activity: workbenchBackgrounds.activityBar,
  "left-header": workbenchBackgrounds.sideBar,
  left: workbenchBackgrounds.sideBar,
  "main-header": workbenchBackgrounds.main,
  "main-left": workbenchBackgrounds.panel,
  main: workbenchBackgrounds.main,
  "main-right": workbenchBackgrounds.panel,
  "secondary-header": workbenchBackgrounds.panel,
  secondary: workbenchBackgrounds.panel,
  status: workbenchBackgrounds.statusBar,
  overlay: workbenchBackgrounds.widget,
  "floating-header": workbenchBackgrounds.widget,
  floating: workbenchBackgrounds.widget,
} as const satisfies Record<WorkbenchArea, string>;

export const workbenchFocusBorder = vscodeColor("focusBorder", "var(--chakra-colors-color-palette-focus-ring)");

export const workbenchCommandPaletteBackground = workbenchBackgrounds.widget;

export const getWorkbenchAreaBackground = (area: WorkbenchArea) => workbenchAreaBackgrounds[area];
