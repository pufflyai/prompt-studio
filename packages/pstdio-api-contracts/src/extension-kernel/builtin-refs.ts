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

// Native dashboard screens published as host pages. An extension links a native screen
// the same way it links any page: { kind: "page", page: workbenchPages.workspaces,
// resource: workspaceRef }. Settings is not a page; open it by command.
export const workbenchPages = {
  workspaces: hostRef("page", "workspaces"),
  sessions: hostRef("page", "sessions"),
  start: hostRef("page", "start"),
};

// The kinds each host page binds (what `pst extensions check` validates page-target
// resource arguments against) and the reserved un-prefixed URL segment each owns.
// Start serializes as the bare project URL.
export const workbenchPageDefinitions = {
  workspaces: { ref: workbenchPages.workspaces, path: "workspaces", binds: ["workspace"] },
  sessions: { ref: workbenchPages.sessions, path: "sessions", binds: ["session", "session-draft"] },
  start: { ref: workbenchPages.start, path: "", binds: [] },
} as const;

export const workbenchSlots = {
  projectNavigation: hostRef("navigation-item", "project.navigation"),
  projectSettings: hostRef("settings-panel", "project.settings"),
  statusBarLeading: hostRef("status-bar-item", "status-bar.leading"),
  statusBarTrailing: hostRef("status-bar-item", "status-bar.trailing"),
};
