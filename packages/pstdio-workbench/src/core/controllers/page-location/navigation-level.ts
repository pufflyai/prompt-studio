import type { PageLocation } from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";

interface NavigationLevelsInput {
  location: PageLocation | undefined;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
}

// A page with a content navigation tree starts a Sidenav level. Levels nest along the location's
// parent chain; the list runs from the outermost level to the innermost one. A page opened inside
// itself, such as a sub-ticket, stays one level, shown for its innermost location.
export const resolveNavigationLevels = (input: NavigationLevelsInput) => {
  const levels: { owner: NonNullable<ReturnType<NavigationTreeRegistry["resolveOwner"]>>; location: PageLocation }[] =
    [];
  for (let current = input.location; current; current = current.parent) {
    const page = input.pages.find(
      (candidate) => candidate.ref.id === current.page.id && candidate.ref.extensionId === current.page.extensionId,
    );
    const owner = page && input.navigationTrees.resolveOwner("page", page.id, "content");
    if (owner && !levels.some((level) => level.owner.id === owner.id)) levels.unshift({ owner, location: current });
  }
  return levels;
};
