import type { ShellModuleContribution } from "../../core";
import { registerDashboardShellContributions } from "./modules/dashboard";
import { registerDashboardProjectMode } from "./modules/project-mode";
import { registerDashboardSettingsMode } from "./modules/settings-mode";

export const createDashboardExampleModule = (): ShellModuleContribution => ({
  id: "dashboard-example",
  activate(ctx) {
    registerDashboardShellContributions(ctx);
    registerDashboardProjectMode(ctx);
    registerDashboardSettingsMode(ctx);
    ctx.modes.setActiveMode("project");
  },
});
