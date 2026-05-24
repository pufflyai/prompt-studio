import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createDashboardSessions, type DashboardSession, subscribeDashboardData } from "../../data/dashboard-data";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "../../shared/project-context";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { createSessionCommandId } from "./session-commands";

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

const getDateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const getSessionDateLabel = (date: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((today.getTime() - sessionDay.getTime()) / 86_400_000);

  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const createSessionNode = (session: DashboardSession): TreeNode => ({
  id: session.resource.uri,
  label: session.title,
  icon: sessionStatusIcon(session.status),
  iconColor: sessionStatusColor(session.status),
  resource: session.resource,
});

const groupSessionNodesByDate = (sessions: DashboardSession[]) => {
  const sections: TreeViewSection[] = [];

  for (const session of sessions) {
    const updatedAt = new Date(session.updatedAt);
    const sectionId = `sessions-${getDateKey(updatedAt)}`;
    const label = getSessionDateLabel(updatedAt);
    const previousSection = sections[sections.length - 1];

    if (previousSection?.id === sectionId) {
      previousSection.nodes.push(createSessionNode(session));
    } else {
      sections.push({ id: sectionId, label, collapsible: false, nodes: [createSessionNode(session)] });
    }
  }

  return sections;
};

const createSessionsSidebarSections = (projectId: string | undefined): TreeViewSection[] => [
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
        target: { kind: "command", commandId: createSessionCommandId },
      },
    ],
  },
  ...groupSessionNodesByDate(createDashboardSessions(projectId)),
];

export const registerSessionsSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.sessionsSidebar,
    title: "Sessions",
    getBody: () => createSessionsSidebarSections(getDashboardSelectedProjectId(ctx)),
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

  const refreshSessionsSidebar = () => ctx.renderers.refresh(dashboardWidgetIds.sessionsSidebar);
  const unsubscribeDashboardData = subscribeDashboardData(refreshSessionsSidebar);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshSessionsSidebar);

  return {
    dispose: () => {
      unsubscribeDashboardData();
      unsubscribeProject();
    },
  };
};

export const syncSessionsSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.openWidget(dashboardWidgetIds.sessionsSidebar, { resource, title: "Sessions", pinned: true });
  ctx.renderers.setSelectedNode(dashboardWidgetIds.sessionsSidebar, resource.uri);
  ctx.renderers.refresh(dashboardWidgetIds.sessionsSidebar);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};
