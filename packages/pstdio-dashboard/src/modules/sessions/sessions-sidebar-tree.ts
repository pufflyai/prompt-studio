import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardSessions, type DashboardSession } from "./data/dashboard-sessions";

type SessionNodeTarget = "resource" | "floating";

interface BuildSessionsSidebarSectionsInput {
  sessions: DashboardSession[];
  workspace?: ResourceRef;
  includeSearch?: boolean;
  includeNewSession?: boolean;
  nodeTarget?: SessionNodeTarget;
}

interface CreateSessionsSidebarSectionsInput extends Omit<BuildSessionsSidebarSectionsInput, "sessions"> {
  projectId?: string;
}

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

const metadataString = (resource: ResourceRef | undefined, key: string) => {
  const value = resource?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const getWorkspaceResourceId = (resource: ResourceRef | undefined) => {
  if (!resource) return undefined;
  if (resource.kind === "workspace") return resource.id ?? metadataString(resource, "workspaceId");
  return metadataString(resource, "workspaceId");
};

const createSessionNode = (session: DashboardSession, target: SessionNodeTarget): TreeNode => ({
  id: session.resource.uri,
  label: session.title,
  icon: sessionStatusIcon(session.status),
  iconColor: sessionStatusColor(session.status),
  ...(target === "resource"
    ? { resource: session.resource }
    : {
        target: {
          kind: "command",
          commandId: dashboardCommandIds.openFloatingSession,
          args: { resource: session.resource },
        } as const,
      }),
});

const groupSessionNodesByDate = (sessions: DashboardSession[], target: SessionNodeTarget) => {
  const sections: TreeViewSection[] = [];

  for (const session of sessions) {
    const lastActivityAt = new Date(session.lastActivityAt);
    const sectionId = `sessions-${getDateKey(lastActivityAt)}`;
    const label = getSessionDateLabel(lastActivityAt);
    const previousSection = sections[sections.length - 1];

    if (previousSection?.id === sectionId) {
      previousSection.nodes.push(createSessionNode(session, target));
    } else {
      sections.push({ id: sectionId, label, collapsible: false, nodes: [createSessionNode(session, target)] });
    }
  }

  return sections;
};

const createNewSessionTarget = (workspace: ResourceRef | undefined) => ({
  kind: "command" as const,
  commandId: dashboardCommandIds.createSession,
  ...(workspace ? { args: { workspace } } : {}),
});

const createSessionActionNodes = (input: BuildSessionsSidebarSectionsInput): TreeNode[] => [
  ...(input.includeSearch
    ? [
        {
          id: "search-sessions",
          label: "Search",
          icon: "Search",
          target: { kind: "command" as const, commandId: dashboardCommandIds.openCommandPalette },
        },
      ]
    : []),
  ...(input.includeNewSession
    ? [
        {
          id: "new-session",
          label: "New session",
          icon: "PenBox",
          target: createNewSessionTarget(input.workspace),
        },
      ]
    : []),
];

export const buildSessionsSidebarSections = (input: BuildSessionsSidebarSectionsInput): TreeViewSection[] => {
  const actionNodes = createSessionActionNodes(input);
  const nodeTarget = input.nodeTarget ?? "resource";
  const workspaceId = getWorkspaceResourceId(input.workspace);
  const sessions = workspaceId
    ? input.sessions.filter((session) => session.workspaceId === workspaceId)
    : input.sessions;

  return [
    ...(actionNodes.length > 0 ? [{ id: "session-actions", nodes: actionNodes } satisfies TreeViewSection] : []),
    ...groupSessionNodesByDate(sessions, nodeTarget),
  ];
};

export const createSessionsSidebarSections = (input: CreateSessionsSidebarSectionsInput): TreeViewSection[] =>
  buildSessionsSidebarSections({
    ...input,
    sessions: createDashboardSessions(input.projectId),
  });

export const registerSessionsSidebarTree = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.sessionsSidebar,
    title: "Sessions",
    getBody: () =>
      createSessionsSidebarSections({
        projectId: getDashboardSelectedProjectId(ctx),
        includeSearch: true,
        includeNewSession: true,
      }),
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

  const refreshSessionSidebars = () => {
    for (const treeId of [dashboardWidgetIds.sessionsSidebar, dashboardWidgetIds.workspaceSidebar]) {
      if (ctx.renderers.getTreeRenderer(treeId)) ctx.renderers.refresh(treeId);
    }
  };
  const unsubscribeDashboardData = subscribeDashboardData(refreshSessionSidebars);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshSessionSidebars);

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
