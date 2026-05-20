import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { createDashboardNavigationParser } from "@/services/workbench/navigation/dashboard-navigation";

// Registers the single ingress parser that turns dashboard deep links into
// workbench navigation targets.
export const createNavigationModule = (): WorkbenchModuleContribution => ({
  id: "pstdio-dashboard-workbench.navigation",
  activate(ctx) {
    ctx.navigation.registerParser(createDashboardNavigationParser());
  },
});
