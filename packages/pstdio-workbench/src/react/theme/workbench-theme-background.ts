import type { WorkbenchRegion } from "../../core";

const chakraBackgrounds = {
  sidenav: "var(--chakra-colors-bg-subtle)",
  main: "var(--chakra-colors-bg)",
  panel: "var(--chakra-colors-bg-panel)",
} as const;

const vscodeColor = (token: string, fallback: string) =>
  `var(--chakra-colors-vscode-${token.replaceAll(".", "-")}, ${fallback})`;

export const workbenchBackgrounds = {
  sidenav: vscodeColor("sideBar.background", chakraBackgrounds.sidenav),
  main: vscodeColor("editor.background", chakraBackgrounds.main),
  widget: vscodeColor("editorWidget.background", vscodeColor("panel.background", chakraBackgrounds.panel)),
} as const;

const workbenchRegionBackgrounds = {
  nav: workbenchBackgrounds.main,
  activity: workbenchBackgrounds.main,
  sidenav: workbenchBackgrounds.sidenav,
  "main-header": workbenchBackgrounds.main,
  "main-left-menu": workbenchBackgrounds.main,
  main: workbenchBackgrounds.main,
  "main-right-menu": workbenchBackgrounds.main,
  "secondary-header": workbenchBackgrounds.main,
  "secondary-left-menu": workbenchBackgrounds.main,
  secondary: workbenchBackgrounds.main,
  "secondary-right-menu": workbenchBackgrounds.main,
  status: workbenchBackgrounds.main,
  overlay: workbenchBackgrounds.main,
  "side-header": workbenchBackgrounds.main,
  "side-left-menu": workbenchBackgrounds.main,
  side: workbenchBackgrounds.main,
  "side-right-menu": workbenchBackgrounds.main,
} as const satisfies Record<WorkbenchRegion, string>;

export const workbenchFocusBorder = vscodeColor("focusBorder", "var(--chakra-colors-color-palette-focus-ring)");

export const workbenchCommandPaletteBackground = workbenchBackgrounds.widget;

export const getWorkbenchRegionBackground = (region: WorkbenchRegion) => workbenchRegionBackgrounds[region];
