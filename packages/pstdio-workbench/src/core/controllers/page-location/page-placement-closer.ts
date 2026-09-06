import type { PageLocation, PageRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPageCloseResolution } from "../../registries/pages/page-registry-internals";
import type { ResolvedPageLocation, WorkbenchPageNavigationResult } from "./page-location-types";

interface PagePlacementCloserInput {
  commit(
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
  ): WorkbenchPageNavigationResult;
  fail(source: "navigation", error: unknown): WorkbenchPageNavigationResult;
  getCurrent(): { projectId?: string; location?: PageLocation };
  getPageRef(pageId: string): PageRef | undefined;
  normalizePage(page: PageRef): ResolvedPageLocation;
  normalizeStored(location: PageLocation): ResolvedPageLocation;
  resolveClosePlacement(identity: PlacementIdentity): WorkbenchPageCloseResolution;
}

export const createPagePlacementCloser = (input: PagePlacementCloserInput) => {
  const closeToParent = (
    projectId: string,
    location: PageLocation,
    resolution: Extract<WorkbenchPageCloseResolution, { kind: "parent" }>,
  ) => {
    const contextualParent = location.parent ? input.normalizeStored(location.parent) : undefined;
    const parent = input.getPageRef(resolution.parentId);
    if (!parent) throw new Error(`Unknown parent page: ${resolution.parentId}`);
    const resolved = contextualParent?.pageId === resolution.parentId ? contextualParent : input.normalizePage(parent);
    return input.commit(
      projectId,
      { ...resolved, pageStates: resolution.pageStates },
      "replace",
      "closePagePlacementToParent",
    );
  };

  const closeWithinPage = (
    projectId: string,
    location: PageLocation,
    resolution: Extract<WorkbenchPageCloseResolution, { kind: "stay" }>,
  ) => {
    const page = input.getPageRef(resolution.target.pageId);
    if (!page) throw new Error(`Unknown page: ${resolution.target.pageId}`);
    const resolved = input.normalizeStored({
      page,
      ...(resolution.target.resource ? { resource: resolution.target.resource } : {}),
      ...(resolution.target.section ? { section: resolution.target.section } : {}),
      ...(location.parent ? { parent: location.parent } : {}),
    });
    return input.commit(
      projectId,
      {
        ...resolved,
        pageStates: resolution.pageStates,
        ...(resolution.target.open ? { open: resolution.target.open } : {}),
      },
      resolution.locationChanged ? "replace" : "none",
      "closePagePlacement",
    );
  };

  return (identity: PlacementIdentity) => {
    const current = input.getCurrent();
    if (!current.projectId || !current.location) {
      return input.fail("navigation", new Error("Cannot close a page placement without an active location"));
    }
    try {
      if (identity.kind !== "page") throw new Error("Only page-owned placements can close through page navigation");
      const resolution = input.resolveClosePlacement(identity);
      return resolution.kind === "parent"
        ? closeToParent(current.projectId, current.location, resolution)
        : closeWithinPage(current.projectId, current.location, resolution);
    } catch (error) {
      return input.fail("navigation", error);
    }
  };
};
