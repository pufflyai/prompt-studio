import { getSurface, type ResourceRef, type WorkbenchArea } from "../../../core";

export const areaResourceKind = "workbench-area";
export const areaMapRendererId = "area-map.placeholder";

export const areaLabels = {
  nav: "Nav (top chrome)",
  activity: "Activity bar",
  "left-header": "Left side header",
  left: "Left side panel",
  "main-header": "Main header area",
  "main-left": "Main left panel",
  main: "Main editor area",
  "main-right": "Main right panel",
  "secondary-header": "Secondary header",
  secondary: "Secondary panel",
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

// Describes a surface by its role in the resource-projected model, so the map reads as
// anchors / projections / chrome / transient rather than a flat list of areas. The
// per-panel header strips are shown as the header region of their content area.
export const describeSurface = (area: WorkbenchArea): string => {
  if (area !== "nav" && area.endsWith("-header")) {
    return `header region of ${area.slice(0, -"-header".length)}`;
  }
  const surface = getSurface(area);
  if (surface.role === "anchor") {
    return surface.anchor === "primary"
      ? "anchor · primary"
      : `anchor · ${surface.anchor} (${surface.persistence}/${surface.candidates})`;
  }
  if (surface.role === "projection") {
    return `projection → ${surface.reads.join(" + ")}${surface.navigator ? " · navigator" : ""}`;
  }
  return surface.role;
};
