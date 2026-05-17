import { type WorkbenchArea, workbenchThemeCssVariableMap } from "../../core";

const themeVariable = (variable: string, fallback: string) => `var(${variable}, ${fallback})`;

export const workbenchBackgrounds = {
  activityBar: themeVariable(workbenchThemeCssVariableMap.activityBarBackground, "var(--chakra-colors-bg-muted)"),
  sideBar: themeVariable(workbenchThemeCssVariableMap.sideBarBackground, "var(--chakra-colors-bg-subtle)"),
  main: themeVariable(workbenchThemeCssVariableMap.mainBackground, "var(--chakra-colors-bg)"),
  panel: themeVariable(workbenchThemeCssVariableMap.panelBackground, "var(--chakra-colors-bg-panel)"),
  statusBar: themeVariable(workbenchThemeCssVariableMap.statusBarBackground, "var(--chakra-colors-bg-muted)"),
} as const;

const workbenchAreaBackgrounds = {
  top: workbenchBackgrounds.main,
  activityBar: workbenchBackgrounds.activityBar,
  "left-header": workbenchBackgrounds.sideBar,
  left: workbenchBackgrounds.sideBar,
  "main-header": workbenchBackgrounds.main,
  "main-left-header": workbenchBackgrounds.panel,
  "main-left": workbenchBackgrounds.panel,
  main: workbenchBackgrounds.main,
  "main-right-header": workbenchBackgrounds.panel,
  "main-right": workbenchBackgrounds.panel,
  "main-bottom-header": workbenchBackgrounds.panel,
  "main-bottom": workbenchBackgrounds.panel,
  status: workbenchBackgrounds.statusBar,
  overlay: workbenchBackgrounds.panel,
  "floating-header": workbenchBackgrounds.panel,
  floating: workbenchBackgrounds.panel,
} as const satisfies Record<WorkbenchArea, string>;

export const workbenchFocusBorder = themeVariable(
  workbenchThemeCssVariableMap.focusBorder,
  "var(--chakra-colors-color-palette-focus-ring)",
);

export const workbenchCommandPaletteBackground = themeVariable(
  workbenchThemeCssVariableMap.commandPaletteBackground,
  "var(--chakra-colors-bg-panel)",
);

export const getWorkbenchAreaBackground = (area: WorkbenchArea) => workbenchAreaBackgrounds[area];
