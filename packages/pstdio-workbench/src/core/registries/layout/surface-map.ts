import { type WorkbenchRegion, workbenchRegions } from "./layout-types";

// The surface map describes the *behavioural* role of each workbench region: which
// regions host a resource (anchors), which render an anchor's resource (projections),
// and which are frame chrome or the transient overlay layer. The project scope root is
// not a surface; it is handled by the layout persistence scope.

// Logical anchor identity, independent of the region id that currently hosts it.
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
export type AnchorReadId = AnchorId;

export interface AnchorSurface {
  role: "anchor";
  anchor: AnchorId;
  persistence: AnchorPersistence;
  candidates: AnchorCandidates;
}

export interface ProjectionSurface {
  role: "projection";
  reads: AnchorReadId[];
  // The sidebar navigator both reads primary (highlight) and selects it (the picker).
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

export const surfaceMap: Record<WorkbenchRegion, SurfaceDescriptor> = {
  // The top bar hosts breadcrumbs (primary trail) and session status (attached), so it
  // reads both anchors — it is a projection, not inert chrome.
  nav: projection(["primary", "attached"]),
  activity: chrome,
  "sidebar-header": projection(["primary"]),
  sidebar: projection(["primary"], true),
  "main-header": projection(["primary"]),
  "main-left-menu": projection(["primary"]),
  main: anchor("primary", "primary", "global"),
  "main-right-menu": projection(["primary"]),
  "secondary-header": projection(["primary"]),
  "secondary-left-menu": projection(["secondary"]),
  secondary: anchor("secondary", "derived", "scoped"),
  "secondary-right-menu": projection(["secondary"]),
  status: projection(["primary", "attached"]),
  overlay: transient,
  "side-header": projection(["attached"]),
  "side-left-menu": projection(["attached"]),
  side: anchor("attached", "detached", "scoped"),
  "side-right-menu": projection(["attached"]),
};

export const getSurface = (region: WorkbenchRegion) => surfaceMap[region];

export const listAnchorRegions = () =>
  workbenchRegions.filter((region): region is WorkbenchRegion => surfaceMap[region].role === "anchor");

export const listProjectionRegions = () =>
  workbenchRegions.filter((region): region is WorkbenchRegion => surfaceMap[region].role === "projection");

export const listProjectionsReading = (anchorId: AnchorReadId) =>
  workbenchRegions.filter((region) => {
    const surface = surfaceMap[region];
    return surface.role === "projection" && surface.reads.includes(anchorId);
  });

// Reverse lookup: which region currently hosts a given logical anchor.
export const resolveAnchorRegion = (anchorId: AnchorId) => {
  const region = workbenchRegions.find((candidate) => {
    const surface = surfaceMap[candidate];
    return surface.role === "anchor" && surface.anchor === anchorId;
  });
  if (!region) throw new Error(`No region hosts anchor: ${anchorId}`);
  return region;
};
