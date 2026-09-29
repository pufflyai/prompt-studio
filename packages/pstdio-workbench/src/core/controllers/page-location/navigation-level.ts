import { type PageLocation, workbenchPages } from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import type { TreeNode } from "../../registries/renderers/tree-renderer-types";
import { pageLocationTitle, targetFromLocation } from "./page-location-presentation";

interface NavigationLevelInput {
  location: PageLocation | undefined;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
  mode: { id: string; label: string };
}

export const resolveNavigationLevel = (input: NavigationLevelInput) => {
  const findOwner = (location: PageLocation | undefined) => {
    for (let current = location; current; current = current.parent) {
      const page = input.pages.find(
        (page) => page.ref.id === current.page.id && page.ref.extensionId === current.page.extensionId,
      );
      const owner = page && input.navigationTrees.resolveOwner("page", page.id, "content");
      if (owner) return { owner, location: current };
    }
    return undefined;
  };
  const level = findOwner(input.location);
  if (!level) return undefined;
  const parent = findOwner(level.location.parent);
  return {
    ...level,
    parent: {
      key: parent?.owner.id ?? input.mode.id,
      label: parent ? pageLocationTitle(parent.location, input.pages) : input.mode.label,
      fallback: targetFromLocation(parent?.location ?? level.location.parent ?? { page: workbenchPages.start }),
    },
  };
};

export const createNavigationBackNode = (
  level: NonNullable<ReturnType<typeof resolveNavigationLevel>>,
  remembered?: PageLocation,
) =>
  ({
    id: "navigation.back",
    label: level.parent.label,
    icon: "arrow-left",
    rowVariant: "back",
    target: remembered ? targetFromLocation(remembered) : level.parent.fallback,
    canReorder: false,
    canHide: false,
    canDrag: false,
    canDrop: false,
  }) satisfies TreeNode;
