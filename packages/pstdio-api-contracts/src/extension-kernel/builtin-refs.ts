import { commandRef } from "./refs";
import { dockedWorkbenchRegions, type ResourceKindDefinition } from "./types/composition";
import type { ContributionKind } from "./types/contribution-identity";
import type { NavigationTarget } from "./types/navigation-target";
import type { ResourceRef } from "./types/resources";

const hostRef = <Kind extends ContributionKind>(kind: Kind, id: string) => ({ extensionId: "pstdio", kind, id });

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
  /** @deprecated Use sessionBrowser.pages.sessions; the legacy target delegates to the installed provider. */
  sessions: hostRef("page", "sessions"),
  /** @deprecated Use sessionBrowser.pages.session; the legacy target delegates to the installed provider. */
  session: hostRef("page", "session"),
  /** @deprecated Use sessionBrowser.pages.draft; the legacy target delegates to the installed provider. */
  newSession: hostRef("page", "new-session"),
  /** @deprecated Use sessionBrowser.pages.compose; the legacy target delegates to the installed provider. */
  sessionComposer: hostRef("page", "session-composer"),
  /** @deprecated Use workspacePages.list from the Workspaces provider. */
  workspaces: hostRef("page", "workspaces"),
  /** @deprecated Use workspacePages.workspace, files, or history from the Workspaces provider. */
  workspace: hostRef("page", "workspace"),
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
    primary: { cardinality: "one", resourceKinds: [] },
  },
  session: {
    ref: workbenchPages.session,
    mode: workbenchModes.sessions,
    path: "session",
    primary: { cardinality: "one", resourceKinds: ["session", "session-draft"] },
  },
  newSession: {
    ref: workbenchPages.newSession,
    mode: workbenchModes.sessions,
    path: "sessions/new",
    primary: { cardinality: "one", resourceKinds: ["session-draft"] },
  },
  sessionComposer: {
    ref: workbenchPages.sessionComposer,
    mode: workbenchModes.sessions,
    path: "sessions/compose",
    primary: { cardinality: "one", resourceKinds: [] },
  },
  workspaces: {
    legacy: true,
    ref: workbenchPages.workspaces,
    mode: workbenchModes.project,
    path: "workspaces",
    primary: { cardinality: "one", resourceKinds: [] },
  },
  workspace: {
    legacy: true,
    ref: workbenchPages.workspace,
    mode: workbenchModes.project,
    path: "workspace",
    primary: { cardinality: "many", resourceKinds: ["workspace"] },
  },
} as const;

export const workbenchPanels = {
  /** @deprecated Use sessionBrowser.panels.conversation. */
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
  /** Controls rendered inside the device-local Developer settings surface. */
  developerSettings: hostRef("settings-panel", "developer.settings"),
  /** App-wide settings available from every project. */
  globalSettings: hostRef("settings-panel", "global.settings"),
  projectSettings: hostRef("settings-panel", "project.settings"),
  /** Custom controls shown in the owner's extension detail Settings tab. */
  extensionSettings: hostRef("settings-panel", "extension.settings"),
  statusBarLeading: hostRef("status-bar-item", "status-bar.leading"),
  statusBarTrailing: hostRef("status-bar-item", "status-bar.trailing"),
};

/** Dashboard commands available through a webview's commands.execute capability. */
export const workbenchCommands = {
  /** Attach this project to a folder on the serving device through the host's folder picker. */
  chooseProjectFolder: commandRef<Record<string, never>, void>({
    extensionId: "pstdio",
    id: "dashboard.chooseProjectFolder",
  }),
  /** Open the platform terminal for the invocation's authorized local workspace. */
  openWorkspaceTerminal: commandRef<{ workspaceId?: string }, void>({
    extensionId: "pstdio",
    id: "dashboard.openWorkspaceTerminal",
  }),
  /** Reveal a workspace-relative entry through the desktop host when available. */
  revealWorkspaceEntry: commandRef<{ path: string }, void>({
    extensionId: "pstdio",
    id: "workbench.workspace.revealEntry",
  }),
  recentResources: commandRef<
    Record<string, never>,
    Array<{ resource: ResourceRef; target: Extract<NavigationTarget, { kind: "page" | "compound" }> }>
  >({
    extensionId: "pstdio",
    id: "workbench.resources.recent",
  }),
  /** @deprecated Use sessionBrowser.commands.create through ctx.commands.run or a navigation target. */
  newConversation: commandRef<Record<string, never>, void>({ extensionId: "pstdio", id: "dashboard.createSession" }),
  openToolSearch: commandRef<Record<string, never>, void>({
    extensionId: "pstdio",
    id: "dashboard.openCommandPalette",
  }),
  retryProjectSetup: commandRef<Record<string, never>, void>({
    extensionId: "pstdio",
    id: "workbench.project.retrySetup",
  }),
};
