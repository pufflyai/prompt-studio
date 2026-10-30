import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { resourceKey, workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore, type WorkbenchModuleContext } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { createCommandPaletteModule } from "../command-palette/module";
import { createHeadersModule } from "../headers/module";
import { createHelpModule } from "../help/module";
import { createNotificationsModule } from "../notifications/module";
import { DesktopProjectTabsController } from "../projects/desktop-project-tabs-controller";
import { createProjectsModule } from "../projects/module";
import { createSessionsModule } from "../sessions/module";
import { createSettingsModule } from "../settings/module";
import { createStartModule } from "../start/module";
import { createWorkspacesModule } from "../workspaces/module";
import { seedSidenavStory } from "./dashboard-sidenav-story-data";
import { createSidenavModule } from "./module";

const PROJECT_ID = "demo-project";
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
  type: "ticket",
  id: "PS-163",
  label: "PS-163 Workbench navigation",
  icon: "FileText",
  metadata: { projectId: PROJECT_ID },
};
const ticketResource = {
  type: "ticket",
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
  type: "workspace",
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
      canResolve: (resource) => resource.type === "ticket",
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
      parentId: workbenchPages.start.id,
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "ticket",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: ticketsView.id,
        },
        cardinality: "one",
      },
      slots: [],
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
        input.resource?.type === "ticket"
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
                    id: resourceKey(linkedWorkspaceResource),
                    label: linkedWorkspaceResource.label,
                    icon: "GitBranch",
                    resource: linkedWorkspaceResource,
                    target: {
                      kind: "page",
                      page: workbenchPages.workspace,
                      resource: {
                        type: linkedWorkspaceResource.type,
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
const linkSessionsToWorkspace = () => {
  getWriter("workspace_sessions")?.truncateAndWrite([
    { id: "link-1", workspace_id: "workspace-1", session_id: "session-today-1" },
    { id: "link-2", workspace_id: "workspace-1", session_id: "session-yesterday" },
  ]);
};
const bootstrapWorkbench = (desktop = false) => {
  seedSidenavStory(PROJECT_ID);
  linkSessionsToWorkspace();
  const workbench = createWorkbench();
  for (const module of [
    createSidenavModule(),
    createCommandPaletteModule(),
    createWorkspacesModule(),
    createProjectsModule(),
    createHeadersModule(desktop ? new DesktopProjectTabsController([], async () => {}) : undefined),
    createHelpModule(),
    createNotificationsModule(),
    createSessionsModule(),
    createSettingsModule(),
    createStartModule(),
    createTicketsNavigationModule(),
  ]) {
    workbench.registerModule(module);
  }
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
  fullscreen: true,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant;
const SidenavStory = (props: { open: (workbench: WorkbenchCore) => void; desktop?: boolean }) => {
  const { open, desktop } = props;
  const [workbench] = useState(() => {
    const next = bootstrapWorkbench(desktop);
    open(next);
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
  id: "dashboard-sidenav--project-mode",
  render: () => <SidenavStory open={openStartPage} />,
};
export const OverflowWithPinnedChrome: Story = {
  id: "dashboard-sidenav--overflow-with-pinned-chrome",
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
};
// Aggregate collection: Workspaces is not duplicated in the resource region.
export const WorkspacesView: Story = {
  id: "dashboard-sidenav--workspaces-view",
  render: () => <SidenavStory open={(workbench) => void openWorkspacesPage(workbench)} />,
};
export const WorkspacesViewHover: Story = {
  id: "dashboard-sidenav--workspaces-view-hover",
  render: () => <SidenavStory open={(workbench) => void openWorkspacesPage(workbench)} />,
};
// F17: a separator marks the boundary before the ticket's resource tree.
export const TicketMode: Story = {
  id: "dashboard-sidenav--ticket-mode",
  name: "Ticket page navigation",
  render: () => <SidenavStory open={openTicketPage} />,
};
export const DesktopSessionNavigation: Story = {
  id: "dashboard-sidenav--desktop-session-navigation",
  name: "Desktop session navigation",
  render: () => <SidenavStory desktop open={(workbench) => void openSessionsPage(workbench)} />,
};
// F22: the linked resource keeps the ticket ancestry and Back restores the selected ticket.
export const TicketWorkspaceBackJourney: Story = {
  id: "dashboard-sidenav--ticket-workspace-back-journey",
  name: "Ticket linked workspace and back",
  render: () => <SidenavStory open={openTicketPage} />,
};
// Session mode: global collections stay fixed above an expanded Sessions group with inline creation.
export const SessionMode: Story = {
  id: "dashboard-sidenav--session-mode",
  render: () => <SidenavStory open={(workbench) => void openSessionsPage(workbench)} />,
};
// Workspace resource: global collections stay fixed above the expanded, workspace-scoped Sessions group.
export const WorkspaceResource: Story = {
  id: "dashboard-sidenav--workspace-resource",
  render: () => (
    <SidenavStory
      open={(workbench) => {
        const workspace = workbench.resources
          .listResources("")
          .find((entry) => entry.resource.type === "workspace")?.resource;
        if (workspace) openWorkspacesPage(workbench, workspace);
      }}
    />
  ),
};
