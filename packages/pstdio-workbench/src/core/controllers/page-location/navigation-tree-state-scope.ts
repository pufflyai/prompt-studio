import { type PageLocation, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-types";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { resolveNavigationLevels } from "./navigation-level";

export const resourceNavigationStateScope = (input: {
  projectId?: string;
  location?: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
}) => {
  const level = resolveNavigationLevels({ ...input, location: input.location }).at(-1);
  return level
    ? JSON.stringify(["page-navigation", input.projectId, level.owner.id, resourceKey(level.location.resource)])
    : undefined;
};
