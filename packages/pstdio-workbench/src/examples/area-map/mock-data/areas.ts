import { classicFrame, type Frame, getSurface, type ResourceRef } from "../../../core";

export type AreaMapArea = keyof typeof classicFrame.slots;
export const areaMapAreas = Object.keys(classicFrame.slots) as AreaMapArea[];

export const areaResourceKind = "workbench-area";
export const areaMapRendererId = "area-map.placeholder";

export const areaLabels = {
  nav: "Nav (top chrome)",
  activity: "Activity bar",
  left: "Left side panel",
  main: "Main editor area",
  side: "Side panel",
  secondary: "Secondary panel",
  status: "Status bar",
  overlay: "Overlay layer",
} as const satisfies Record<AreaMapArea, string>;

interface AreaResourceInput {
  id?: string;
  uri?: string;
  label?: string;
}

export const createAreaResource = (area: AreaMapArea, input: AreaResourceInput = {}): ResourceRef => ({
  kind: areaResourceKind,
  id: input.id ?? area,
  uri: input.uri ?? `pstdio://area-map/${area}`,
  label: input.label ?? areaLabels[area],
  icon: "SquareDashed",
  metadata: { area },
});

export const areaWidgetId = (area: AreaMapArea) => `area-map.${area}`;

// Describes a surface by its role in the resource-projected model, so the map reads as
// anchors / projections / chrome / transient rather than a flat list of areas. The
// per-panel header strips are shown as the header region of their content area.
export const describeSurface = (frame: Frame, area: AreaMapArea): string => {
  if (area === frame.primary) return "anchor · primary";
  if (frame.secondary?.slot === area) {
    return `anchor · secondary (${frame.secondary.persistence}/${frame.secondary.candidates})`;
  }
  if (frame.attached?.slot === area) {
    return `anchor · attached (${frame.attached.persistence}/${frame.attached.candidates})`;
  }
  const surface = getSurface(frame, area);
  if (!surface) return "unavailable in active frame";
  if (surface.role === "projection") {
    return `projection → ${surface.reads?.join(" + ")}${surface.navigator ? " · navigator" : ""}`;
  }
  return surface.role;
};
