import type { NavigationTreeSlot, ResourceRef, TreeViewSection, WorkbenchModuleContext } from "@pstdio/workbench";

const declarations: Record<NavigationTreeSlot, readonly string[]> = {
  header: ["dashboard.sidenav.search"],
  content: [
    "dashboard.notifications.sidenav-nav",
    "dashboard.sessions.project-nav",
    "dashboard.workspaces.project-nav",
    "dashboard.sessions.list",
  ],
  footer: ["dashboard.help.footer", "dashboard.settings.footer"],
};

const dashboardModes = ["project"] as const;

interface DashboardNavigationContribution {
  id: string;
  modes: readonly (typeof dashboardModes)[number][];
  slot?: NavigationTreeSlot;
  defaultExpandedSectionIds?: string[];
  /** Host navigation reads project data unless it declares a resource dependency. */
  resolveResource?(input: { modeId: string; resource?: ResourceRef }): ResourceRef | undefined;
  getSections(
    ctx: WorkbenchModuleContext,
    input: { modeId: string; resource?: ResourceRef },
  ): Promise<TreeViewSection[]> | TreeViewSection[];
}

export const registerDashboardNavigationContribution = (
  ctx: WorkbenchModuleContext,
  contribution: DashboardNavigationContribution,
) => {
  const slot = contribution.slot ?? "content";
  const declarationIndex = declarations[slot].indexOf(contribution.id);
  const resolveResource = contribution.resolveResource;

  return contribution.modes.map((modeId) =>
    ctx.navigationTrees.registerContribution({
      id: `${contribution.id}.${modeId}`,
      owner: { kind: "mode", id: modeId, extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: declarationIndex < 0 ? declarations[slot].length : declarationIndex,
      slot,
      defaultExpandedSectionIds: contribution.defaultExpandedSectionIds,
      resolveResource: (resource) => resolveResource?.({ modeId, resource }),
      getSections: ({ resource }) => contribution.getSections(ctx, { modeId, resource }),
    }),
  );
};
