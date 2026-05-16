import type { ResourceRef, WorkbenchArea } from "../../../core";

export const areaResourceKind = "workbench-area";
export const areaMapRendererId = "area-map.placeholder";

export const areaLabels = {
  top: "Top header area",
  activityBar: "Activity bar",
  "left-header": "Left side header",
  left: "Left side panel",
  "main-header": "Main header area",
  "main-left-header": "Main left header",
  "main-left": "Main left panel",
  main: "Main editor area",
  "main-right-header": "Main right header",
  "main-right": "Main right panel",
  "main-bottom-header": "Main bottom header",
  "main-bottom": "Main bottom panel",
  status: "Status bar",
  overlay: "Overlay layer",
  "floating-header": "Floating header",
  floating: "Floating panel",
} as const satisfies Record<WorkbenchArea, string>;

interface AreaResourceInput {
  id?: string;
  uri?: string;
  label?: string;
}

export const createAreaResource = (area: WorkbenchArea, input: AreaResourceInput = {}): ResourceRef => ({
  kind: areaResourceKind,
  id: input.id ?? area,
  uri: input.uri ?? `pstdio://area-map/${area}`,
  label: input.label ?? areaLabels[area],
  icon: "SquareDashed",
  metadata: { area },
});

export const areaWidgetId = (area: WorkbenchArea) => `area-map.${area}`;

export interface BottomExtraWidget {
  id: string;
  label: string;
}

export const bottomExtraWidgets: BottomExtraWidget[] = [
  { id: "main-bottom-output", label: "Output" },
  { id: "main-bottom-problems", label: "Problems" },
  { id: "main-bottom-terminal", label: "Terminal" },
  { id: "main-bottom-tests", label: "Tests" },
];
