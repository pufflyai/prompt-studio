import type { ShellCore } from "../../core";
import { activateDashboard } from "./modules/dashboard";
import { activateDashboardProjectMode } from "./modules/project-mode";
import { activateDashboardSettingsMode } from "./modules/settings-mode";

export const activateDashboardExample = (shell: ShellCore) => {
  activateDashboard(shell);
  activateDashboardProjectMode(shell);
  activateDashboardSettingsMode(shell);
  shell.modes.setActiveMode("project");
};
