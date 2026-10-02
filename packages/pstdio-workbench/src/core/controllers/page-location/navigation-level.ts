import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchModeContribution } from "../../registries/modes/mode-registry";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";

interface NavigationLevelsInput {
  location: PageLocation | undefined;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
}

// The part of the mode registry that tells whether a mode replaces the project Sidenav.
export interface NavigationLevelModes {
  getMode(id: string): Pick<WorkbenchModeContribution, "chrome"> | undefined;
}

// The registries that decide whether a page leaves the project navigation.
export interface ProjectNavigationSources {
  navigationTrees: NavigationTreeRegistry;
  modes: NavigationLevelModes;
}

type ProjectNavigationInput = NavigationLevelsInput & ProjectNavigationSources;

const findPage = (location: PageLocation, pages: readonly WorkbenchPageContribution[]) =>
  pages.find(
    (candidate) => candidate.ref.id === location.page.id && candidate.ref.extensionId === location.page.extensionId,
  );

const levelOwner = (location: PageLocation, input: NavigationLevelsInput) => {
  const page = findPage(location, input.pages);
  return page ? input.navigationTrees.resolveOwner("page", page.id, "content") : undefined;
};

// A page leaves the project navigation when it starts a Sidenav level, or when its mode replaces the
// whole Sidenav, such as a mode with its own activity rail. Either way the project rows are gone.
export const leavesProjectNavigation = (location: PageLocation, input: ProjectNavigationInput) => {
  const page = findPage(location, input.pages);
  if (!page) return false;
  if (input.navigationTrees.resolveOwner("page", page.id, "content")) return true;
  return input.modes.getMode(page.modeId)?.chrome?.sidenav !== undefined;
};

// A page with a content navigation tree starts a Sidenav level. Levels nest along the location's
// parent chain; the list runs from the outermost level to the innermost one. A page opened inside
// itself, such as a sub-ticket, stays one level, shown for its innermost location.
export const resolveNavigationLevels = (input: NavigationLevelsInput) => {
  const levels: { owner: NonNullable<ReturnType<NavigationTreeRegistry["resolveOwner"]>>; location: PageLocation }[] =
    [];
  for (let current = input.location; current; current = current.parent) {
    const owner = levelOwner(current, input);
    if (owner && !levels.some((level) => level.owner.id === owner.id)) levels.unshift({ owner, location: current });
  }
  return levels;
};

// The part of a location's parent chain that sits before the first page that leaves the project
// navigation. A location that starts outside it has none, so its breadcrumb cannot lead the user back.
// Every level counts here, including a page opened inside itself, which the level list folds into one.
export const resolveRootLevelLocation = (input: ProjectNavigationInput) => {
  let rootLevel = input.location;
  for (let current = input.location; current; current = current.parent) {
    if (leavesProjectNavigation(current, input)) rootLevel = current.parent;
  }
  return rootLevel;
};
