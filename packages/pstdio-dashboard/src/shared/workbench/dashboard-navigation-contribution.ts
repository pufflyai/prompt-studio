import type { NavigationTreeSlot, ResourceRef, TreeViewSection, WorkbenchModuleContext } from "@pstdio/workbench";

const declarations: Record<NavigationTreeSlot, readonly string[]> = {
  header: [],
  content: [
    "dashboard.sidenav.search",
    "dashboard.notifications.sidenav-nav",
    "dashboard.sessions.project-nav",
    "dashboard.workspaces.project-nav",
    "dashboard.sessions.list",
  ],
  footer: ["dashboard.help.footer", "dashboard.settings.footer"],
};

const dashboardModes = ["project", "sessions"] as const;

interface DashboardNavigationContribution {
  id: string;
  modes: readonly (typeof dashboardModes)[number][];
  slot?: NavigationTreeSlot;
  defaultExpandedSectionIds?: string[];
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

  return contribution.modes.map((modeId) =>
    ctx.navigationTrees.registerContribution({
      id: `${contribution.id}.${modeId}`,
      owner: { kind: "mode", id: modeId, extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: declarationIndex < 0 ? declarations[slot].length : declarationIndex,
      slot,
      defaultExpandedSectionIds: contribution.defaultExpandedSectionIds,
      getSections: ({ resource }) => contribution.getSections(ctx, { modeId, resource }),
    }),
  );
};
