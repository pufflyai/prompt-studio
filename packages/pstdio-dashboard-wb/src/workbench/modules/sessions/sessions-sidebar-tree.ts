import type { ResourceRef, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createDashboardSessions } from "../../data/dashboard-data";
import { dashboardWidgetIds } from "../../shared/widget-ids";

const sessionStatusIcon = (status: string) => {
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled") return "CircleStop";
  if (status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  if (status === "awaiting_input") return "CircleDot";
  return "CircleDashed";
};

const sessionStatusColor = (status: string) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled" || status === "disconnected") return "fg.warning";
  if (status === "queued") return "fg.info";
  return "fg.muted";
};

const createSessionsSidebarSections = (): TreeViewSection[] => [
  {
    id: "session-actions",
    nodes: [
      {
        id: "search-sessions",
        label: "Search",
        icon: "Search",
        target: { kind: "command", commandId: "dashboard.openCommandPalette" },
      },
      {
        id: "new-session",
        label: "New session",
        icon: "PenBox",
        target: { kind: "command", commandId: "dashboard.createSession" },
      },
    ],
  },
  {
    id: "sessions",
    label: "Sessions",
    collapsible: false,
    nodes: createDashboardSessions().map((session) => ({
      id: session.resource.uri,
      label: session.title,
      icon: sessionStatusIcon(session.status),
      iconColor: sessionStatusColor(session.status),
      resource: session.resource,
    })),
  },
];

export const registerSessionsSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.sessionsSidebar,
    title: "Sessions",
    defaultExpandedSectionIds: ["sessions"],
    getBody: () => createSessionsSidebarSections(),
    getChildren: () => [],
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionsSidebar,
      title: "Sessions",
      area: "left",
      rendererId: dashboardWidgetIds.sessionsSidebar,
      singleton: true,
      areaSize: { defaultPx: 288, minPx: 220, maxPx: 360 },
    },
    { priority: 75 },
  );
};

export const syncSessionsSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.openWidget(dashboardWidgetIds.sessionsSidebar, { resource, title: "Sessions", pinned: true });
  ctx.renderers.setSelectedNode(dashboardWidgetIds.sessionsSidebar, resource.uri);
  ctx.renderers.refresh(dashboardWidgetIds.sessionsSidebar);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};
