import { Box } from "@chakra-ui/react";
import { workspacePages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import { useState } from "react";
import { getWriter } from "@/lib/sync/collections";
import { createSidenavModule } from "@/modules/sidenav/module";
import { selectDashboardProject } from "@/shared/app/project-context";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { registerWorkspaceSessionNavigation } from "./workspace-session-navigation";

const NavigationPreview = (props: { workspace?: boolean }) => {
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.registerModule(createSidenavModule());
    next.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    registerWorkspaceProviderViews(next);
    selectDashboardProject(next, { id: "workspace-navigation-preview", name: "Project" });
    getWriter("sessions")?.truncateAndWrite([
      {
        id: "preview-session",
        project_id: "workspace-navigation-preview",
        workspace_id: "preview-workspace",
        title: "Update workspace navigation",
        status: "completed",
        archived: false,
        updated_at: "2026-11-06T10:00:00Z",
      },
    ]);
    next.navigationTrees.registerContribution({
      id: "preview.project",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "pstdio",
      declarationIndex: 0,
      getSections: () => [
        {
          id: "navigation.root",
          nodes: [
            { id: "home", label: "Home", icon: "House" },
            { id: "sessions", label: "Sessions", icon: "MessagesSquare" },
            { id: "workspaces", label: "Workspaces", icon: "FolderGit2" },
          ],
        },
      ],
    });
    registerWorkspaceSessionNavigation(next);
    const page = props.workspace ? workspacePages.workspace : workspacePages.files;
    next.pageLocations.setProject("workspace-navigation-preview");
    next.pageLocations.navigate({
      kind: "page",
      page,
      resource: { type: "workspace", id: "preview-workspace", label: props.workspace ? "Workspace" : "Project folder" },
    });
    return next;
  });
  return (
    <Box h="100dvh">
      <Workbench workbench={workbench} />
    </Box>
  );
};

export default {
  title: "Proposals/PS-125 Workspace session navigation",
  component: NavigationPreview,
  fullscreen: true,
};
export const ProjectFolder = { name: "Project folder keeps project navigation" };
export const WorkspaceSessions = { name: "Workspace opens sessions sub-navigation", args: { workspace: true } };
