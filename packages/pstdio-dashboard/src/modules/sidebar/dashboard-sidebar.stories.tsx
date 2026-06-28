import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createWorkbenchCore, type WorkbenchCore } from "pstdio-workbench/core";
import { Workbench } from "pstdio-workbench/react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { createHeadersModule } from "../headers/module";
import { createProjectsModule } from "../projects/module";
import { createSessionsModule } from "../sessions/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSidebarModule } from "./module";

const PROJECT_ID = "demo-project";

const seedSessions = () => {
  getWriter("sessions")?.truncateAndWrite([
    sessionRow("session-today-1", "Refactor sidebar", "completed", "2026-06-24T09:00:00Z", "workspace-1"),
    sessionRow("session-today-2", "Investigate flaky test", "failed", "2026-06-24T08:00:00Z"),
    sessionRow("session-yesterday", "Wire up board", "completed", "2026-06-23T15:00:00Z", "workspace-1"),
  ]);
  getWriter("workspaces")?.truncateAndWrite([
    {
      id: "workspace-1",
      project_id: PROJECT_ID,
      name: "Mode-driven sidebar",
      branch: "feature/PS-107",
      worktree_path: "/repo/.pstdio/workspaces/PS-107",
      archived: false,
      workspace_shorthand: "PS-107_A1",
      setup_error: null,
      created_at: "2026-06-22T08:10:00Z",
      updated_at: "2026-06-24T09:00:00Z",
      deleted_at: null,
    },
  ]);
};

const sessionRow = (id: string, title: string, status: string, updatedAt: string, workspaceId?: string) => ({
  id,
  project_id: PROJECT_ID,
  title,
  status,
  agent: null,
  last_selected_model: null,
  archived: false,
  last_request_started: updatedAt,
  last_request_ended: updatedAt,
  created_at: updatedAt,
  updated_at: updatedAt,
  deleted_at: null,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
});

const linkSessionsToWorkspace = () => {
  getWriter("workspace_sessions")?.truncateAndWrite([
    { id: "link-1", workspace_id: "workspace-1", session_id: "session-today-1" },
    { id: "link-2", workspace_id: "workspace-1", session_id: "session-yesterday" },
  ]);
};

const bootstrapWorkbench = () => {
  seedSessions();
  linkSessionsToWorkspace();

  const workbench = createWorkbenchCore();
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });

  for (const module of [
    createSidebarModule(),
    createWorkspacesModule(),
    createProjectsModule(),
    createHeadersModule(),
    createSessionsModule(),
  ]) {
    workbench.registerModule(module);
  }

  selectDashboardProject(workbench, { id: PROJECT_ID, name: "Prompt Studio" });
  return workbench;
};

const openInMode = (workbench: WorkbenchCore, resource: Parameters<WorkbenchCore["resources"]["openResource"]>[0]) => {
  void workbench.resources.openResource(resource, { replaceActive: true });
};

const meta = {
  title: "Dashboard/Sidebar",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const SidebarStory = (props: { open: (workbench: WorkbenchCore) => void }) => {
  const workbench = bootstrapWorkbench();
  props.open(workbench);

  return (
    <Box h="100dvh" w="full">
      <Workbench workbench={workbench} />
    </Box>
  );
};

// Project mode: project switcher and search stay fixed above the nav links and footer.
export const ProjectMode: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.start)} />,
};

// Workspaces view: project and search stay fixed above the project navigation; create is on the Workspaces row.
export const WorkspacesView: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.workspaces)} />,
};

// Session mode: project · search · new-session stay fixed above one collapsible "Sessions" group.
export const SessionMode: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.sessions)} />,
};

// Workspace mode: fixed project/search/new-session header above the workspace-scoped Sessions group.
export const WorkspaceMode: Story = {
  render: () => (
    <SidebarStory
      open={(workbench) => {
        const workspace = workbench.resources
          .listResources("")
          .find((entry) => entry.resource.kind === "workspace")?.resource;
        if (workspace) openInMode(workbench, workspace);
      }}
    />
  ),
};
