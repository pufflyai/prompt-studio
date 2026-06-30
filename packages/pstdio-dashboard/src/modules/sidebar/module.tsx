import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { registerDashboardSidebar } from "@/shared/workbench/dashboard-sidebar";

// Search is a header row in every project-scoped mode (mirrors how the footer contributes its
// help/settings rows). Mode "*" keeps it visible even in extension-declared modes such as ticket.
const registerSearchHeader = (ctx: WorkbenchModuleContributionContext) => {
  registerSidebarContribution(ctx, {
    id: "dashboard.sidebar.search",
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

// The sidebar slice owns the single, mode-reactive dashboard sidebar widget. The composition
// logic and the show/select helpers live in shared so other slices can drive the sidebar
// without a cross-module import.
export const createSidebarModule = () =>
  ({
    id: "dashboard.sidebar",
    activate(ctx) {
      registerSearchHeader(ctx);
      return registerDashboardSidebar(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
