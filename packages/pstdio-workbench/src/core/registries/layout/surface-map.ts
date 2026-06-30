import { type WorkbenchArea, workbenchAreas } from "./layout-types";

// The surface map describes the *behavioural* role of each workbench area: which
// areas host a resource (anchors), which render an anchor's resource (projections),
// and which are frame chrome or the transient overlay layer. It is additive metadata
// over the existing area ids — the cosmetic rename (main-bottom → secondary, etc.) and
// the region collapse happen in a later phase. The project scope root is NOT a surface;
// it is handled by the layout persistence scope.

// Logical anchor identity, independent of the area id that currently hosts it.
export type AnchorId = "primary" | "secondary" | "attached";

// Does an anchor's active selection survive a primary change?
// - primary: the subject itself.
// - derived: re-scopes/clears on primary change (terminals follow the workspace).
// - detached: persists across primary navigation, but disconnects when the new
//   primary's scoped candidates no longer list it (scope wins).
export type AnchorPersistence = "primary" | "derived" | "detached";

// What the anchor's quick-pick offers: everything, or filtered by primary.
export type AnchorCandidates = "global" | "scoped";

// Which anchor(s) a projection renders.
export type AnchorReadId = "primary" | "attached";

export interface AnchorSurface {
  role: "anchor";
  anchor: AnchorId;
  persistence: AnchorPersistence;
  candidates: AnchorCandidates;
}

export interface ProjectionSurface {
  role: "projection";
  reads: AnchorReadId[];
  // The left navigator both reads primary (highlight) and selects it (the picker).
  navigator?: boolean;
}

export interface ChromeSurface {
  role: "chrome";
}

export interface TransientSurface {
  role: "transient";
}

export type SurfaceDescriptor = AnchorSurface | ProjectionSurface | ChromeSurface | TransientSurface;

const anchor = (anchor: AnchorId, persistence: AnchorPersistence, candidates: AnchorCandidates): AnchorSurface => ({
  role: "anchor",
  anchor,
  persistence,
  candidates,
});

const projection = (reads: AnchorReadId[], navigator = false): ProjectionSurface =>
  navigator ? { role: "projection", reads, navigator } : { role: "projection", reads };

const chrome: ChromeSurface = { role: "chrome" };
const transient: TransientSurface = { role: "transient" };

export const surfaceMap: Record<WorkbenchArea, SurfaceDescriptor> = {
  // The top bar hosts breadcrumbs (primary trail) and session status (attached), so it
  // reads both anchors — it is a projection, not inert chrome.
  nav: projection(["primary", "attached"]),
  activity: chrome,
  "left-header": projection(["primary"]),
  left: projection(["primary"], true),
  "main-header": projection(["primary"]),
  "main-left": projection(["primary"]),
  main: anchor("primary", "primary", "global"),
  "main-right": projection(["primary"]),
  "secondary-header": projection(["primary"]),
  secondary: anchor("secondary", "derived", "scoped"),
  status: projection(["primary", "attached"]),
  overlay: transient,
  "floating-header": projection(["attached"]),
  floating: anchor("attached", "detached", "scoped"),
};

export const getSurface = (area: WorkbenchArea) => surfaceMap[area];

export const listAnchorAreas = () =>
  workbenchAreas.filter((area): area is WorkbenchArea => surfaceMap[area].role === "anchor");

export const listProjectionAreas = () =>
  workbenchAreas.filter((area): area is WorkbenchArea => surfaceMap[area].role === "projection");

export const listProjectionsReading = (anchorId: AnchorReadId) =>
  workbenchAreas.filter((area) => {
    const surface = surfaceMap[area];
    return surface.role === "projection" && surface.reads.includes(anchorId);
  });

// Reverse lookup: which area currently hosts a given logical anchor.
export const resolveAnchorArea = (anchorId: AnchorId) => {
  const area = workbenchAreas.find((candidate) => {
    const surface = surfaceMap[candidate];
    return surface.role === "anchor" && surface.anchor === anchorId;
  });
  if (!area) throw new Error(`No area hosts anchor: ${anchorId}`);
  return area;
};
