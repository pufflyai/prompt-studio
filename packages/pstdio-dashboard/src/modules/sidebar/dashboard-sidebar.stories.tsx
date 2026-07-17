import { Box } from "@chakra-ui/react";
import { createWorkbenchCore, type WorkbenchCore, type WorkbenchModuleContribution } from "@pstdio/workbench/core";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createCommandPaletteModule } from "../command-palette/module";
import { registerExtensionSidebarContributions } from "../extensions/extension-sidebar-contributions";
import { createHeadersModule } from "../headers/module";
import { createNotificationsModule } from "../notifications/module";
import { createProjectsModule } from "../projects/module";
import { createDashboardSessions } from "../sessions/data/dashboard-sessions";
import { createSessionsModule } from "../sessions/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSidebarModule } from "./module";

const PROJECT_ID = "demo-project";
const WORKSPACES_KEYBINDING = "mod+shift+w";
const STORY_EXTENSION_METADATA = {
  ...emptyDashboardExtensionMetadata,
  dataRenderers: [
    {
      id: "pstdio-core-tickets.tickets",
      extensionId: "pstdio.pstdio-core-tickets",
      title: "Tickets",
      resourceKind: "ticket",
      queryCommandId: "pstdio-core-tickets.query-tickets",
    },
  ],
};

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
  getWriter("notifications")?.truncateAndWrite([
    {
      id: "notification-1",
      project_id: PROJECT_ID,
      title: "Review generated ticket summary",
      body: "The planner has an update ready for review.",
      kind: "needs_review",
      priority: "normal",
      status: "open",
      source: "dashboard",
      origin: "core",
      source_extension_id: null,
      actor_type: "agent",
      actor_id: null,
      target_json: null,
      related_json: [],
      actions_json: [],
      dedupe_key: "story-notification",
      metadata_json: null,
      created_at: "2026-06-24T09:30:00Z",
      updated_at: "2026-06-24T09:30:00Z",
      read_at: null,
      resolved_at: null,
      snoozed_until: null,
      expires_at: null,
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
    createCommandPaletteModule(),
    createWorkspacesModule(),
    createProjectsModule(),
    createHeadersModule(),
    createNotificationsModule(),
    createSessionsModule(),
    {
      id: "story.extension-sidebar",
      activate(ctx) {
        registerExtensionSidebarContributions(ctx, () => ({
          metadata: STORY_EXTENSION_METADATA,
          projectId: PROJECT_ID,
        }));
        return undefined;
      },
    } satisfies WorkbenchModuleContribution,
  ]) {
    workbench.registerModule(module);
  }

  workbench.keybindings.registerKeybinding({
    commandId: dashboardCommandIds.openWorkspaces,
    keybinding: WORKSPACES_KEYBINDING,
  });

  selectDashboardProject(workbench, { id: PROJECT_ID, name: "Prompt Studio" });
  return workbench;
};

const openInMode = (workbench: WorkbenchCore, resource: Parameters<WorkbenchCore["resources"]["openResource"]>[0]) => {
  void workbench.resources.openResource(resource, { replaceActive: true });
};

const workspaceResource = (workbench: WorkbenchCore) =>
  workbench.resources.listResources("").find((entry) => entry.resource.kind === "workspace")?.resource;

const seedWorkspaceChildren = (workbench: WorkbenchCore, workspaceUri: string) => {
  workbench.resources.registerProvider({
    id: "story.workspace-children",
    kind: "session",
    list: () =>
      createDashboardSessions(PROJECT_ID)
        .filter((session) => session.workspaceId === "workspace-1")
        .map(({ resource }) => ({ resource: { ...resource, parent: workspaceUri } })),
  });
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

// Primary navigation stays in the header, ordered below notifications and above resource content.
export const ProjectMode: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.start)} />,
};

// Workspace creation remains an inline action on the header's Workspaces row.
export const WorkspacesView: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.workspaces)} />,
};

export const WorkspacesViewHover: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.workspaces)} />,
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector('[data-tree-list-focus-id="dashboard-workbench://dashboard-view/workspaces"]')
      ?.setAttribute("data-hover", "");
  },
};

// Session mode keeps the same primary header navigation above the chronological Sessions group.
export const SessionMode: Story = {
  render: () => <SidebarStory open={(workbench) => openInMode(workbench, dashboardResources.sessions)} />,
};

// Workspace mode keeps primary navigation outside the workspace's resource section.
export const WorkspaceMode: Story = {
  render: () => (
    <SidebarStory
      open={(workbench) => {
        const workspace = workspaceResource(workbench);
        if (workspace) openInMode(workbench, workspace);
      }}
    />
  ),
};

// Product providers do not yet model workspace children. This story supplies parent edges so
// the selection-driven resource region can be reviewed independently of its future producers.
export const ResourceChildren: Story = {
  render: () => (
    <SidebarStory
      open={(workbench) => {
        const workspace = workspaceResource(workbench);
        if (!workspace) return;
        seedWorkspaceChildren(workbench, workspace.uri);
        openInMode(workbench, workspace);
      }}
    />
  ),
};
