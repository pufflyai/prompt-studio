import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { registerDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";

// Search is a header row in every project-scoped mode (mirrors how the footer contributes its
// help/settings rows). Mode "*" keeps it visible even in extension-declared modes such as ticket.
const registerSearchHeader = (ctx: WorkbenchModuleContributionContext) => {
  registerSidenavContribution(ctx, {
    id: "dashboard.sidenav.search",
    modes: ["*"],
    region: "header",
    order: 0,
    getHeaderNodes: () => [
      {
        id: "search",
        label: "Search",
        icon: "Search",
        canHide: true,
        commandId: dashboardCommandIds.openCommandPalette,
        target: { kind: "command", commandId: dashboardCommandIds.openCommandPalette },
      },
    ],
  });
};

// The sidenav slice owns the single, mode-reactive dashboard sidenav widget. The composition
// logic and the show/select helpers live in shared so other slices can drive the sidenav
// without a cross-module import.
export const createSidenavModule = () =>
  ({
    id: "dashboard.sidenav",
    activate(ctx) {
      registerSearchHeader(ctx);
      return registerDashboardSidenav(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
