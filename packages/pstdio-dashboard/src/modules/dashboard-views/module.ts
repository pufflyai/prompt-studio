import { standardResourceIcons, type WorkbenchModuleContribution } from "pstdio-workbench/core";
import { listDashboardViewEntries } from "@/shared/workbench/contributions/dashboard-view-contributions";

export const createDashboardViewsModule = () =>
  ({
    id: "dashboard.views",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "dashboard-view",
        label: "Dashboard view",
        icon: standardResourceIcons.dataRenderer,
      });
      ctx.resources.registerProvider({
        id: "dashboard-workbench.dashboard-views",
        kind: "dashboard-view",
        list: () => listDashboardViewEntries(ctx),
      });
    },
  }) satisfies WorkbenchModuleContribution;
