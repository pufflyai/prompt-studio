import type { TreeViewSection, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  dashboardNavigationSections,
  registerDashboardNavigationContribution,
} from "@/shared/workbench/dashboard-navigation-contribution";
import { registerDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";

const registerSearchSection = (ctx: WorkbenchModuleContext) => {
  const sections: TreeViewSection[] = [
    {
      ...dashboardNavigationSections.header,
      nodes: [
        {
          id: "search",
          label: "Search",
          icon: "Search",
          canHide: true,
          commandId: dashboardCommandIds.openCommandPalette,
          target: { kind: "command", commandId: dashboardCommandIds.openCommandPalette },
        },
      ],
    },
  ];
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.sidenav.search",
    slot: "header",
    modes: ["project"],
    getStructure: () => sections,
    getSections: () => sections,
  });
};

// The sidenav slice owns the single, mode-reactive dashboard sidenav widget. The composition
// logic and the show/select helpers live in shared so other slices can drive the sidenav
// without a cross-module import.
export const createSidenavModule = () =>
  ({
    id: "dashboard.sidenav",
    activate(ctx) {
      registerSearchSection(ctx);
      return registerDashboardSidenav(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
