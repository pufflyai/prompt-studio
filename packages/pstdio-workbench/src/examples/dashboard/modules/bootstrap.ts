import type { WorkbenchModuleContribution } from "../../../core";
import { dashboardResources } from "../shared/mock-data/resources";

// Runs last to bring the dashboard to its opening state. `setActiveMode` is
// synchronous so the project navigation tree is ready immediately; opening the
// tickets resource routes through the tickets slice's presenter.
export const createBootstrapModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.bootstrap",
  activate(ctx) {
    ctx.context.set("project.open", true);
    ctx.modes.setActiveMode("project");
    void ctx.resources.openResource(dashboardResources.tickets, {});
  },
});
