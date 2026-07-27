import { standardResourceIcons, type WorkbenchModuleContribution } from "@pstdio/workbench";
import { listDashboardViewEntries } from "@/shared/workbench/contributions/dashboard-view-contributions";

export const createDashboardViewsModule = () =>
  ({
    id: "dashboard.panels",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "dashboard-view",
        label: "Dashboard view",
        icon: standardResourceIcons.kanbanRenderer,
      });
      ctx.resources.registerProvider({
        id: "dashboard-workbench.dashboard-views",
        kind: "dashboard-view",
        list: () => listDashboardViewEntries(ctx),
      });
    },
  }) satisfies WorkbenchModuleContribution;
