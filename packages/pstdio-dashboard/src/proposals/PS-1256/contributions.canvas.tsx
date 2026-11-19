import { ExtensionContributions } from "./extension-contributions";
export default { title: "Proposals/PS-1256 Workspace contributions", fullscreen: true };
export const WorkspaceProviders = () => (
  <ExtensionContributions
    extensionId="pstdio.workspaces"
    automations={[]}
    metadata={
      {
        workspaceTypes: [
          {
            id: "pstdio.workspaces.workspace-type.git",
            localId: "git",
            extensionId: "pstdio.workspaces",
            label: "Git worktree",
          },
          {
            id: "pstdio.workspaces.workspace-type.folder",
            localId: "folder",
            extensionId: "pstdio.workspaces",
            label: "Project folder",
          },
        ],
      } as never
    }
  />
);
