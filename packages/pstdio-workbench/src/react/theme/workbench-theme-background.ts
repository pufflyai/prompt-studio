import type { classicFrame, SlotId } from "../../core";

type ClassicSlotId = keyof typeof classicFrame.slots;

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

const classicSlotBackgrounds = {
  nav: workbenchBackgrounds.main,
  activity: workbenchBackgrounds.activityBar,
  left: workbenchBackgrounds.sideBar,
  main: workbenchBackgrounds.main,
  secondary: workbenchBackgrounds.panel,
  status: workbenchBackgrounds.statusBar,
  side: workbenchBackgrounds.widget,
  overlay: workbenchBackgrounds.widget,
} as const satisfies Record<ClassicSlotId, string>;

const classicRegionBackgrounds: Record<string, string> = {
  "left-header": workbenchBackgrounds.sideBar,
  "main-header": workbenchBackgrounds.main,
  "main-left-menu": workbenchBackgrounds.main,
  "main-right-menu": workbenchBackgrounds.main,
  "secondary-header": workbenchBackgrounds.panel,
  "secondary-left-menu": workbenchBackgrounds.panel,
  "secondary-right-menu": workbenchBackgrounds.panel,
  "side-header": workbenchBackgrounds.widget,
  "side-left-menu": workbenchBackgrounds.widget,
  "side-right-menu": workbenchBackgrounds.widget,
};

export const workbenchFocusBorder = vscodeColor("focusBorder", "var(--chakra-colors-color-palette-focus-ring)");

export const workbenchCommandPaletteBackground = workbenchBackgrounds.widget;

export const getWorkbenchAreaBackground = (area: SlotId) =>
  classicSlotBackgrounds[area as ClassicSlotId] ?? classicRegionBackgrounds[area] ?? workbenchBackgrounds.panel;
