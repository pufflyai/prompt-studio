import type { TreeListGroup, TreeListSection } from "@pstdio/ui";
import type { TreeGroupScope } from "../../../core/registries/renderers/tree-renderer-types";

export const activeTreeGroupLayout = (
  sections: TreeListSection[],
  groups: TreeListGroup[],
  nodeOrderBySection: Record<string, string[]>,
  groupScope?: TreeGroupScope,
) => {
  const scopes = new Set(
    groupScope ? [groupScope.active] : [undefined, ...sections.map((section) => section.moveScope)],
  );
  const activeGroups: TreeListGroup[] = [];
  const inactiveGroupIds = new Set<string>();
  for (const group of groups) {
    const moveScope = group.moveScope ?? groupScope?.root;
    if (scopes.has(moveScope)) activeGroups.push(moveScope === group.moveScope ? group : { ...group, moveScope });
    else inactiveGroupIds.add(group.id);
  }
  // A pinned row reordered in a subnav can also belong to a group in its original level.
  // Give the group precedence while it is visible and keep the saved subnav order for later.
  const activeGroupIds = new Set(activeGroups.map((group) => group.id));
  const groupedNodeIds = new Set(groupScope ? activeGroups.flatMap(({ id }) => nodeOrderBySection[id] ?? []) : []);
  // Inactive groups must not turn into unnamed runs reconstructed from saved memberships.
  const activeNodeOrder = Object.fromEntries(
    Object.entries(nodeOrderBySection)
      .filter(([id]) => !inactiveGroupIds.has(id))
      .map(([id, nodeIds]) => [
        id,
        groupedNodeIds.size > 0 && !activeGroupIds.has(id)
          ? nodeIds.filter((nodeId) => !groupedNodeIds.has(nodeId))
          : nodeIds,
      ]),
  );
  return { groups: activeGroups, nodeOrderBySection: activeNodeOrder };
};

export const mergeLevelSectionOrder = (previous: string[], current: string[]) => {
  const currentIds = new Set(current);
  let next = 0;
  // Keep placements for sections from other levels when saving a visible level's order.
  return [...previous.map((id) => (currentIds.has(id) ? current[next++]! : id)), ...current.slice(next)];
};
