import { Box } from "@chakra-ui/react";
import {
  createWorkbenchCore,
  type WorkbenchCore,
  type WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createCommandPaletteModule } from "../command-palette/module";
import { createHeadersModule } from "../headers/module";
import { createHelpModule } from "../help/module";
import { createNotificationsModule } from "../notifications/module";
import { createProjectsModule } from "../projects/module";
import { createSessionsModule } from "../sessions/module";
import { createSettingsModule } from "../settings/module";
import { createStartModule } from "../start/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSidenavModule } from "./module";

const PROJECT_ID = "demo-project";
const WORKSPACES_KEYBINDING = "mod+shift+w";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const ticketsResource = {
  kind: "dashboard-view",
  uri: `dashboard-workbench://project/${PROJECT_ID}/data-renderer/tickets`,
  id: "tickets",
  label: "Tickets",
  icon: "square-kanban",
  metadata: { collectionId: "tickets", projectId: PROJECT_ID },
};
const ticketResource = {
  kind: "ticket",
  uri: "dashboard-workbench://ticket/PS-164",
  id: "PS-164",
  label: "PS-164 Sidenav resource sections",
  icon: "FileText",
  metadata: { projectId: PROJECT_ID },
};

const createTicketsNavigationModule = () => ({
  id: "story.tickets-navigation",
  activate(ctx: WorkbenchModuleContributionContext) {
    ctx.modes.registerMode({ id: "pstdio-planner.ticket", label: "Ticket", activate: () => undefined });
    registerSidenavContribution(ctx, {
      id: "story.tickets-navigation",
      modes: ["*"],
      region: "header",
      order: 40,
      getHeaderNodes: () => [
        {
          id: ticketsResource.uri,
          label: ticketsResource.label,
          icon: ticketsResource.icon,
          resource: ticketsResource,
        },
      ],
    });
    registerSidenavContribution(ctx, {
      id: "story.ticket-resource",
      modes: ["pstdio-planner.ticket"],
      getSections: (_workbench, input) =>
        input.resource?.kind === "ticket"
          ? [
              {
                id: "ticket",
                nodes: [{ id: "ticket-body", label: ticketResource.label, icon: "FileText" }],
              },
              {
                id: "files",
                label: "Files",
                collapsible: true,
                nodes: [{ id: "research.md", label: "research.md", icon: "FileText" }],
              },
              {
                id: "workspaces",
                label: "Workspaces",
                collapsible: true,
                nodes: [{ id: "PS-164_A1", label: "PS-164_A1", icon: "GitBranch" }],
              },
            ]
          : [],
    });
    for (const sectionId of ["files", "workspaces"]) {
      ctx.renderers.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
    }
    return [];
  },
});

const seedSessions = () => {
  getWriter("sessions")?.truncateAndWrite([
    sessionRow("session-today-1", "Refactor sidenav", "completed", "2026-06-24T09:00:00Z", "workspace-1"),
    sessionRow("session-today-2", "Investigate flaky test", "failed", "2026-06-24T08:00:00Z"),
    sessionRow("session-yesterday", "Wire up board", "completed", "2026-06-23T15:00:00Z", "workspace-1"),
  ]);
  getWriter("workspaces")?.truncateAndWrite([
    {
      id: "workspace-1",
      project_id: PROJECT_ID,
      name: "Mode-driven sidenav",
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
    createSidenavModule(),
    createCommandPaletteModule(),
    createWorkspacesModule(),
    createProjectsModule(),
    createHeadersModule(),
    createHelpModule(),
    createNotificationsModule(),
    createSessionsModule(),
    createSettingsModule(),
    createStartModule(),
    createTicketsNavigationModule(),
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

const meta = {
  title: "Dashboard/Sidenav",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj;

const SidenavStory = (props: { open: (workbench: WorkbenchCore) => void }) => {
  const workbench = bootstrapWorkbench();
  props.open(workbench);

  return (
    <Box h="100dvh" w="full">
      <Workbench workbench={workbench} />
    </Box>
  );
};

// F15: the project selector and global collections stay fixed while the resource region is empty.
export const ProjectMode: Story = {
  render: () => <SidenavStory open={(workbench) => openInMode(workbench, dashboardResources.start)} />,
};

// Aggregate collection: the same header stays mounted and Workspaces is not duplicated in the resource region.
export const WorkspacesView: Story = {
  render: () => <SidenavStory open={(workbench) => openInMode(workbench, dashboardResources.workspaces)} />,
};

export const WorkspacesViewHover: Story = {
  render: () => <SidenavStory open={(workbench) => openInMode(workbench, dashboardResources.workspaces)} />,
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector('[data-tree-list-focus-id="dashboard-workbench://dashboard-view/workspaces"]')
      ?.setAttribute("data-hover", "");
  },
};

// F17: a separator marks the boundary before the ticket's resource tree.
export const TicketMode: Story = {
  name: "Ticket resource separator",
  render: () => (
    <SidenavStory
      open={(workbench) => {
        selectDashboardNavigationResource(workbench, ticketResource);
        workbench.modes.setActiveMode("pstdio-planner.ticket");
      }}
    />
  ),
};

// Session mode: project · search · new-session stay fixed above one collapsible "Sessions" group.
export const SessionMode: Story = {
  render: () => <SidenavStory open={(workbench) => openInMode(workbench, dashboardResources.sessions)} />,
};

// Workspace mode: fixed project/search/new-session header above the workspace-scoped Sessions group.
export const WorkspaceMode: Story = {
  render: () => (
    <SidenavStory
      open={(workbench) => {
        const workspace = workbench.resources
          .listResources("")
          .find((entry) => entry.resource.kind === "workspace")?.resource;
        if (workspace) openInMode(workbench, workspace);
      }}
    />
  ),
};
