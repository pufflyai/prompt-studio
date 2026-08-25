import type { WorkbenchModuleContribution } from "../../../core";
import { dashboardViews } from "../shared/mock-data/resources";

// Runs last to bring the dashboard to its opening state. `setActiveMode` is
// synchronous so the project navigation tree is ready immediately; opening the
// Tickets opens through the shared view registry.
export const createBootstrapModule = (): WorkbenchModuleContribution => ({
  id: "dashboard.bootstrap",
  activate(ctx) {
    ctx.context.set("project.open", true);
    ctx.modes.setActiveMode("project");
    void ctx.views.openView(dashboardViews.tickets.id);
  },
});
