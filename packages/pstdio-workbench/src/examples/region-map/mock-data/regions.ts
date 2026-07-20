import { getSurface, type ResourceRef, type WorkbenchRegion } from "../../../core";

export const regionResourceKind = "workbench-region";
export const regionMapRendererId = "region-map.placeholder";

export const regionLabels = {
  nav: "Nav (top chrome)",
  activity: "Activity bar",
  "sidebar-header": "Sidebar header",
  sidebar: "Sidebar",
  "main-header": "Main header region",
  "main-left-menu": "Main left menu",
  main: "Main editor region",
  "main-right-menu": "Main right menu",
  "secondary-header": "Secondary header",
  secondary: "Secondary panel",
  status: "Status bar",
  overlay: "Overlay layer",
  "side-header": "Side Panel header",
  side: "Side Panel",
} as const satisfies Record<WorkbenchRegion, string>;

interface RegionResourceInput {
  id?: string;
  uri?: string;
  label?: string;
}

export const createRegionResource = (region: WorkbenchRegion, input: RegionResourceInput = {}): ResourceRef => ({
  kind: regionResourceKind,
  id: input.id ?? region,
  uri: input.uri ?? `pstdio://region-map/${region}`,
  label: input.label ?? regionLabels[region],
  icon: "SquareDashed",
  metadata: { region },
});

export const regionWidgetId = (region: WorkbenchRegion) => `region-map.${region}`;

// Describes a surface by its role in the resource-projected model, so the map reads as
// anchors / projections / chrome / transient rather than a flat list of regions. The
// per-panel header strips are shown as the header region of their content region.
export const describeSurface = (region: WorkbenchRegion): string => {
  if (region !== "nav" && region.endsWith("-header")) {
    return `header region of ${region.slice(0, -"-header".length)}`;
  }
  const surface = getSurface(region);
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
