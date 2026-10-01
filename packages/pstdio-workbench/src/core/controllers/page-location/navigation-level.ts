import type { PageLocation } from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";

interface NavigationLevelsInput {
  location: PageLocation | undefined;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
}

const levelOwner = (location: PageLocation, input: NavigationLevelsInput) => {
  const page = input.pages.find(
    (candidate) => candidate.ref.id === location.page.id && candidate.ref.extensionId === location.page.extensionId,
  );
  return page ? input.navigationTrees.resolveOwner("page", page.id, "content") : undefined;
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

// The part of a location's parent chain that sits before the outermost Sidenav level. A location that
// starts inside a level has none, so its breadcrumb cannot lead the user back to the main navigation.
// Every level counts here, including a page opened inside itself, which the level list folds into one.
export const resolveRootLevelLocation = (input: NavigationLevelsInput) => {
  let rootLevel = input.location;
  for (let current = input.location; current; current = current.parent) {
    if (levelOwner(current, input)) rootLevel = current.parent;
  }
  return rootLevel;
};
