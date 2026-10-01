import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { type ProjectNavigationSources, resolveRootLevelLocation } from "./navigation-level";
import type { ResolvedPageLocation } from "./page-location-types";

interface RootLevelLocationTrackerInput {
  levels: ProjectNavigationSources;
  pages(): readonly WorkbenchPageContribution[];
  normalize(location: PageLocation): ResolvedPageLocation;
  resourceKey(resource: ResourceRef): string;
  start(): ResolvedPageLocation;
}

const usesResource = (location: PageLocation | undefined, matches: (resource: ResourceRef) => boolean): boolean => {
  if (!location) return false;
  return Boolean(location.resource && matches(location.resource)) || usesResource(location.parent, matches);
};

// Holds the last location inside the project navigation for the active project. Navigation inside a
// level keeps it, so a breadcrumb that starts with a level page still has somewhere to lead back to.
export const createRootLevelLocationTracker = (input: RootLevelLocationTrackerInput) => {
  let saved: PageLocation | undefined;

  return {
    restore(location: PageLocation | undefined) {
      saved = location;
    },

    remember(location: PageLocation) {
      const resolved = resolveRootLevelLocation({ ...input.levels, location, pages: input.pages() });
      if (resolved) saved = resolved;
      return saved;
    },

    // A removed resource cannot be opened again, so the project falls back to its start page.
    forget(resource: ResourceRef) {
      const removed = input.resourceKey(resource);
      if (saved && usesResource(saved, (candidate) => input.resourceKey(candidate) === removed)) saved = undefined;
    },

    // A saved location stops resolving once its page is gone, which leaves the start page.
    target() {
      if (!saved) return input.start();
      try {
        return input.normalize(saved);
      } catch {
        return input.start();
      }
    },
  };
};
