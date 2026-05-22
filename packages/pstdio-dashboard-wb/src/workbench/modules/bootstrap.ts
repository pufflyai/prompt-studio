import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { dashboardResources } from "../shared/resources";

// Runs last to bring the dashboard to its opening state.
export const createBootstrapModule = () =>
  ({
    id: "dashboard.bootstrap",
    activate(ctx) {
      ctx.context.set("project.open", true);
      void ctx.resources.openResource(dashboardResources.workspaces, {});
    },
  }) satisfies WorkbenchModuleContribution;
