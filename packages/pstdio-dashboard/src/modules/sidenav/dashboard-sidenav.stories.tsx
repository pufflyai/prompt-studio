import { Box } from "@chakra-ui/react";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore, type WorkbenchModuleContext } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { createCommandPaletteModule } from "../command-palette/module";
import { createHeadersModule } from "../headers/module";
import { createHelpModule } from "../help/module";
import { createNotificationsModule } from "../notifications/module";
import { createProjectsModule } from "../projects/module";
import { createSessionBubbleModule } from "../sessions/bubble/module";
import { createSessionsModule } from "../sessions/module";
import { createSettingsModule } from "../settings/module";
import { createStartModule } from "../start/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSidenavModule } from "./module";

const PROJECT_ID = "demo-project";
const WORKSPACES_KEYBINDING = "mod+shift+w";
const STORY_TICKET_PAGE_ID = "story.page.ticket";
const STORY_TICKET_PAGE_REF = { extensionId: "story", kind: "page" as const, id: "ticket" };
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const ticketsView = {
  id: "pstdio-planner.tickets",
  label: "Tickets",
  icon: "square-kanban",
};
const parentTicketResource = {
  kind: "ticket",
  uri: "pstdio://extension-resource/ticket/PS-163",
  id: "PS-163",
  label: "PS-163 Workbench navigation",
  icon: "FileText",
  metadata: { projectId: PROJECT_ID },
};
const ticketResource = {
  type: "ticket",
  kind: "ticket",
  uri: "pstdio://extension-resource/ticket/PS-164",
  id: "PS-164",
  label: "PS-164 Sidenav resource sections",
  icon: "FileText",
  metadata: {
    projectId: PROJECT_ID,
    resourceParent: {
      type: "ticket",
      id: parentTicketResource.id,
      label: parentTicketResource.label,
      metadata: { shorthand: parentTicketResource.id },
    },
  },
};
const linkedWorkspaceResource = {
  kind: "workspace",
  uri: "pstdio://extension-resource/workspace/PS-164_A1",
  id: "PS-164_A1",
  label: "PS-164_A1",
  icon: "GitBranch",
  metadata: {
    projectId: PROJECT_ID,
    workspaceId: "PS-164_A1",
    workspaceShorthand: "PS-164_A1",
    resourceParent: {
      type: "ticket",
      id: ticketResource.id,
      label: ticketResource.label,
      metadata: ticketResource.metadata,
    },
  },
};

const createTicketsNavigationModule = () => ({
  id: "story.tickets-navigation",
  activate(ctx: WorkbenchModuleContext) {
    ctx.resources.registerKind({ kind: "ticket", label: "Ticket", icon: "FileText" });
    ctx.views.registerView({
      id: ticketsView.id,
      title: ticketsView.label,
      icon: ticketsView.icon,
      body: { kind: "react", render: (input) => <Box p="lg">{input.instance.resource?.label}</Box> },
    });
    ctx.resources.registerHierarchyProvider({
      id: "story.ticket-hierarchy",
      canResolve: (resource) => resource.kind === "ticket",
      getParent: (resource) =>
        dashboardResourceParent(ctx, resource, PROJECT_ID) ?? { type: "view", viewId: ticketsView.id },
    });
    ctx.pages.registerPage({
      id: STORY_TICKET_PAGE_ID,
      ref: STORY_TICKET_PAGE_REF,
      title: ticketsView.label,
      icon: ticketsView.icon,
      path: "ticket",
      modeId: "project",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { resourceKinds: ["ticket"], viewId: ticketsView.id, cardinality: "one" },
        },
      ],
    });
    ctx.navigationTrees.registerContribution({
      id: "story.tickets-navigation.project",
      owner: { kind: "mode", id: "project", extensionId: "pstdio" },
      sourceExtensionId: "story",
      declarationIndex: 0,
      getSections: () => [
        {
          id: "navigation.root",
          nodes: [
            {
              id: ticketsView.id,
              label: ticketsView.label,
              icon: ticketsView.icon,
              target: { kind: "page", page: STORY_TICKET_PAGE_REF, resource: ticketResource },
            },
          ],
        },
      ],
    });
    ctx.navigationTrees.registerContribution({
      id: "story.ticket-resource",
      owner: { kind: "page", id: STORY_TICKET_PAGE_ID, extensionId: "story" },
      sourceExtensionId: "story",
      declarationIndex: 1,
      getSections: (input) =>
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
                nodes: [
                  {
                    id: linkedWorkspaceResource.uri,
                    label: linkedWorkspaceResource.label,
                    icon: "GitBranch",
                    resource: linkedWorkspaceResource,
                    target: {
                      kind: "page",
                      page: workbenchPages.workspace,
                      resource: {
                        type: linkedWorkspaceResource.kind,
                        id: linkedWorkspaceResource.id,
                        label: linkedWorkspaceResource.label,
                        metadata: linkedWorkspaceResource.metadata,
                      },
                    },
                  },
                ],
              },
            ]
          : [],
    });
    for (const sectionId of ["files", "workspaces"]) {
      ctx.treeViews.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
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

  const workbench = createWorkbench();

  for (const module of [
    createSidenavModule(),
    createCommandPaletteModule(),
    createWorkspacesModule(),
    createProjectsModule(),
    createHeadersModule(),
    createHelpModule(),
    createNotificationsModule(),
    createSessionBubbleModule(),
    createSessionsModule(),
    createSettingsModule(),
    createStartModule(),
    createTicketsNavigationModule(),
  ]) {
    workbench.registerModule(module);
  }

  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: dashboardCommandIds.openWorkspaces },
    keybinding: WORKSPACES_KEYBINDING,
  });

  selectDashboardProject(workbench, { id: PROJECT_ID, name: "Prompt Studio" });
  workbench.pageLocations.setProject(PROJECT_ID);
  return workbench;
};

const openTicketPage = (workbench: WorkbenchCore) => {
  void workbench.navigation.openTarget({ kind: "page", page: STORY_TICKET_PAGE_REF, resource: ticketResource });
};

const openStartPage = (workbench: WorkbenchCore) =>
  void workbench.navigation.openTarget({ kind: "page", page: workbenchPages.start });

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
  const [workbench] = useState(() => {
    const next = bootstrapWorkbench();
    props.open(next);
    return next;
  });

  return (
    <Box h="100dvh" w="full">
      <Workbench workbench={workbench} />
    </Box>
  );
};

// F15: global collections stay fixed while the resource region is empty.
export const ProjectMode: Story = {
  render: () => <SidenavStory open={openStartPage} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-workbench-panel-header="sidenav"]')).toBeNull();
  },
};

export const OverflowWithPinnedChrome: Story = {
  name: "Overflow with pinned header and footer",
  render: () => (
    <SidenavStory
      open={(workbench) => {
        workbench.navigationTrees.registerContribution({
          id: "story.overflow.header",
          owner: { kind: "mode", id: "project", extensionId: "pstdio" },
          sourceExtensionId: "story.overflow",
          declarationIndex: 0,
          slot: "header",
          getSections: () => [
            {
              id: "overflow-header",
              nodes: [{ id: "overflow-header-item", label: "Pinned header" }],
            },
          ],
        });
        workbench.navigationTrees.registerContribution({
          id: "story.overflow.project",
          owner: { kind: "mode", id: "project", extensionId: "pstdio" },
          sourceExtensionId: "story.overflow",
          declarationIndex: 0,
          getSections: () =>
            Array.from({ length: 24 }, (_, index) => ({
              id: `overflow-${index}`,
              label: `Overflow group ${index + 1}`,
              nodes: [{ id: `overflow-item-${index}`, label: `Overflow item ${index + 1}` }],
            })),
        });
        openStartPage(workbench);
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = await canvas.findByRole("option", { name: "Pinned header" });
    const settings = await canvas.findByRole("option", { name: /^Settings$/ });
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-workbench-region="sidenav"] [data-scope="scroll-area"][data-part="viewport"]',
    );
    await expect(viewport).not.toBeNull();
    const headerTop = header.getBoundingClientRect().top;
    const settingsBottom = settings.getBoundingClientRect().bottom;
    viewport!.scrollTop = viewport!.scrollHeight;
    await expect(header.getBoundingClientRect().top).toBe(headerTop);
    await expect(settings.getBoundingClientRect().bottom).toBe(settingsBottom);
  },
};

// Aggregate collection: Workspaces is not duplicated in the resource region.
export const WorkspacesView: Story = {
  render: () => <SidenavStory open={(workbench) => void openWorkspacesPage(workbench)} />,
};

export const WorkspacesViewHover: Story = {
  render: () => <SidenavStory open={(workbench) => void openWorkspacesPage(workbench)} />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector('[data-tree-list-focus-id="workspaces"]')?.setAttribute("data-hover", "");
  },
};

// F17: a separator marks the boundary before the ticket's resource tree.
export const TicketMode: Story = {
  name: "Ticket page navigation",
  render: () => <SidenavStory open={openTicketPage} />,
};

// F22: the linked resource keeps the ticket ancestry and Back restores the selected ticket.
export const TicketWorkspaceBackJourney: Story = {
  name: "Ticket linked workspace and back",
  render: () => <SidenavStory open={openTicketPage} />,
};

// Session mode: global collections stay fixed above an expanded Sessions group with inline creation.
export const SessionMode: Story = {
  render: () => <SidenavStory open={(workbench) => void openSessionsPage(workbench)} />,
};

// Workspace resource: global collections stay fixed above the expanded, workspace-scoped Sessions group.
export const WorkspaceResource: Story = {
  render: () => (
    <SidenavStory
      open={(workbench) => {
        const workspace = workbench.resources
          .listResources("")
          .find((entry) => entry.resource.kind === "workspace")?.resource;
        if (workspace) openWorkspacesPage(workbench, workspace);
      }}
    />
  ),
};
