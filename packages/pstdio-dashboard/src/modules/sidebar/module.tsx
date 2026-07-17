import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { registerDashboardSidebar } from "@/shared/workbench/dashboard-sidebar";
import { createResourceChildrenSections } from "./resource-children-section";

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

const registerResourceChildren = (ctx: WorkbenchModuleContributionContext) => {
  registerSidebarContribution(ctx, {
    id: "dashboard.sidebar.resource-children",
    modes: ["*"],
    region: "resource",
    order: 0,
    getSections: (_context, input) => {
      const resource = input.resource;
      // Dashboard views are aggregate pages, not resource containers. Their own
      // renderers already own the collection and listing it again duplicates the
      // page in the sidebar while scanning every resource provider on navigation.
      const children = resource && resource.kind !== "dashboard-view" ? ctx.resources.listChildren(resource.uri) : [];
      return createResourceChildrenSections({ resource, children });
    },
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
      registerResourceChildren(ctx);
      return registerDashboardSidebar(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
