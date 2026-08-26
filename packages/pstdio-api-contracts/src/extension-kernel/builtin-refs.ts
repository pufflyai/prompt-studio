import type { ContributionKind } from "./types/contribution-identity";

const hostRef = <Kind extends ContributionKind>(kind: Kind, id: string) => ({ extensionId: "pstdio", kind, id });

export const workbenchCommands = {
  switchMode: hostRef("command", "workbench.action.switchMode"),
};

export const workbenchModes = {
  project: hostRef("mode", "project"),
  settings: hostRef("mode", "settings"),
  workspace: hostRef("mode", "workspace"),
};

export const workbenchResourceKinds = {
  project: hostRef("resource-kind", "project"),
  session: hostRef("resource-kind", "session"),
  workspace: hostRef("resource-kind", "workspace"),
};

export const workbenchSlots = {
  projectNavigation: hostRef("navigation-item", "project.navigation"),
  projectSettings: hostRef("settings-panel", "project.settings"),
  statusBarLeading: hostRef("status-bar-item", "status-bar.leading"),
  statusBarTrailing: hostRef("status-bar-item", "status-bar.trailing"),
};
