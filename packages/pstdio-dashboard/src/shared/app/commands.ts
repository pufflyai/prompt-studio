export const dashboardCommandIds = {
  chooseProjectFolder: "dashboard.chooseProjectFolder",
  clearSelectedProject: "dashboard.clearSelectedProject",
  createProject: "dashboard.createProject",
  switchSession: "dashboard.switchSession",
  createSession: "dashboard.createSession",
  renameSession: "dashboard.renameSession",
  archiveSession: "dashboard.archiveSession",
  deleteSession: "dashboard.deleteSession",
  createWorkspace: "workbench.workspace.create",
  deleteWorkspace: "dashboard.deleteWorkspace",
  renameWorkspace: "dashboard.renameWorkspace",
  openCommandPalette: "dashboard.openCommandPalette",
  openNotifications: "dashboard.openNotifications",
  openCurrentWorkspace: "dashboard.openCurrentWorkspace",
  openDiscord: "dashboard.openDiscord",
  openDocs: "dashboard.openDocs",
  openFile: "dashboard.openFile",
  openSessionPanel: "dashboard.openSessionPanel",
  openProjects: "dashboard.openProjects",
  openSessions: "dashboard.openSessions",
  openShortcuts: "dashboard.openShortcuts",
  openWorkspaceTerminal: "dashboard.openWorkspaceTerminal",
  openWorkspaces: "dashboard.openWorkspaces",
  productInfo: "dashboard.productInfo",
  selectProject: "dashboard.selectProject",
  selectWorkspaceSidenavSession: "dashboard.selectWorkspaceSidenavSession",
} as const;

export interface SelectProjectInput {
  project: {
    id: string;
    name: string;
  };
}
