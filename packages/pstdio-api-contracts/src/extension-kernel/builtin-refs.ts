import { dockedWorkbenchRegions, type ResourceKindDefinition } from "./types/composition";
import type { ContributionKind } from "./types/contribution-identity";

const hostRef = <Kind extends ContributionKind>(kind: Kind, id: string) => ({ extensionId: "pstdio", kind, id });

export const workbenchCommands = {
  switchMode: hostRef("command", "workbench.action.switchMode"),
};

export const workbenchModes = {
  project: hostRef("mode", "project"),
  sessions: hostRef("mode", "sessions"),
  settings: hostRef("mode", "settings"),
};

export const workbenchModeDefinitions = {
  project: { ref: workbenchModes.project, regions: dockedWorkbenchRegions },
  sessions: { ref: workbenchModes.sessions, regions: dockedWorkbenchRegions },
  settings: { ref: workbenchModes.settings, regions: dockedWorkbenchRegions },
} as const;

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

export const workbenchPages = {
  start: hostRef("page", "start"),
  sessions: hostRef("page", "sessions"),
  workspaces: hostRef("page", "workspaces"),
};

export const workbenchPageDefinitions = {
  start: {
    ref: workbenchPages.start,
    mode: workbenchModes.project,
    path: "",
    primary: { cardinality: "one", resourceKinds: [] },
  },
  sessions: {
    ref: workbenchPages.sessions,
    mode: workbenchModes.sessions,
    path: "sessions",
    primary: { cardinality: "many", resourceKinds: ["session", "session-draft"] },
  },
  workspaces: {
    ref: workbenchPages.workspaces,
    mode: workbenchModes.project,
    path: "workspaces",
    primary: { cardinality: "many", resourceKinds: ["workspace"] },
  },
} as const;

export const workbenchPanels = {
  projectSession: hostRef("placement", "project-session"),
};

export const workbenchPanelDefinitions = {
  projectSession: {
    ref: workbenchPanels.projectSession,
    mode: workbenchModes.project,
    cardinality: "many",
    resourceKinds: ["session", "session-draft"],
  },
} as const;

export const workbenchSlots = {
  projectNavigation: hostRef("navigation-item", "project.navigation"),
  projectSettings: hostRef("settings-panel", "project.settings"),
  statusBarLeading: hostRef("status-bar-item", "status-bar.leading"),
  statusBarTrailing: hostRef("status-bar-item", "status-bar.trailing"),
};
