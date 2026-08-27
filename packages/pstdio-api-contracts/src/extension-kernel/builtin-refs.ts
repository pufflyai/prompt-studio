import type { ResourceKindDefinition } from "./types/composition";
import type { ContributionKind } from "./types/contribution-identity";

const hostRef = <Kind extends ContributionKind>(kind: Kind, id: string) => ({ extensionId: "pstdio", kind, id });

export const workbenchCommands = {
  switchMode: hostRef("command", "workbench.action.switchMode"),
};

export const workbenchModes = {
  project: hostRef("mode", "project"),
  settings: hostRef("mode", "settings"),
};

const hostResourceKind = (
  id: string,
  label: string,
  menuSlots: ResourceKindDefinition["menuSlots"],
): ResourceKindDefinition => ({
  id,
  ref: hostRef("resource-kind", id),
  surface: "primary",
  label,
  menuSlots,
});

const headerMenuSlots = [
  { id: "headerPrimary", placement: "header-primary", access: "public" },
  { id: "headerOverflow", placement: "header-overflow", access: "public" },
] as const;

export const workbenchResourceKindDefinitions = {
  project: hostResourceKind("project", "Extension", headerMenuSlots),
  session: hostResourceKind("session", "Session", headerMenuSlots),
  workspace: hostResourceKind("workspace", "Workspace", headerMenuSlots),
};

export const workbenchResourceKinds = {
  project: workbenchResourceKindDefinitions.project.ref,
  session: workbenchResourceKindDefinitions.session.ref,
  workspace: workbenchResourceKindDefinitions.workspace.ref,
};

export const workbenchSlots = {
  projectNavigation: hostRef("navigation-item", "project.navigation"),
  projectSettings: hostRef("settings-panel", "project.settings"),
  statusBarLeading: hostRef("status-bar-item", "status-bar.leading"),
  statusBarTrailing: hostRef("status-bar-item", "status-bar.trailing"),
};
