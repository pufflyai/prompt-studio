import type { WorkbenchModuleContribution } from "../../core";
import { registerDashboardWorkbenchContributions } from "./modules/dashboard";
import { registerDashboardProjectMode } from "./modules/project-mode";
import { registerDashboardSettingsMode } from "./modules/settings-mode";

export const createDashboardExampleModule = (): WorkbenchModuleContribution => ({
  id: "dashboard-example",
  activate(ctx) {
    const disposables = registerDashboardWorkbenchContributions(ctx);
    registerDashboardProjectMode(ctx);
    registerDashboardSettingsMode(ctx);
    ctx.modes.setActiveMode("project");
    return disposables;
  },
});
