import type { TreeListGroup, TreeListSection } from "@pstdio/ui";

export const activeTreeGroupLayout = (
  sections: TreeListSection[],
  groups: TreeListGroup[],
  nodeOrderBySection: Record<string, string[]>,
) => {
  const scopes = new Set(sections.map((section) => section.moveScope));
  const activeGroups = groups.filter((group) => group.moveScope === undefined || scopes.has(group.moveScope));
  const inactiveGroupIds = new Set(groups.filter((group) => !activeGroups.includes(group)).map((group) => group.id));
  // Inactive groups must not turn into the unnamed runs the order model reconstructs from saved memberships.
  const activeNodeOrder = Object.fromEntries(
    Object.entries(nodeOrderBySection).filter(([sectionId]) => !inactiveGroupIds.has(sectionId)),
  );
  return { groups: activeGroups, nodeOrderBySection: activeNodeOrder };
};
