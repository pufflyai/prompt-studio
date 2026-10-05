import { resourceKey, workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import type { ResourceRef, TreeNode, TreeViewSection } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { DashboardSession } from "./data/dashboard-sessions";

type SessionNodeTarget = "resource" | "side";
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
  const daysAgo = Math.round((today.getTime() - sessionDay.getTime()) / 86400000);
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
  if (resource.type === "workspace") return resource.id ?? metadataString(resource, "workspaceId");
  return metadataString(resource, "workspaceId");
};
const createSessionNode = (session: DashboardSession, target: SessionNodeTarget): TreeNode => ({
  id: resourceKey(session.resource),
  label: session.title,
  resource: session.resource,
  icon: sessionStatusIcon(session.status),
  iconColor: sessionStatusColor(session.status),
  ...(target === "resource"
    ? {
        target: {
          kind: "page",
          page: workbenchPages.session,
          resource: session.resource,
        } as const,
      }
    : {
        target: {
          kind: "panel",
          panel: workbenchPanels.projectSession,
          resource: session.resource,
          open: "preview",
        } as const,
      }),
});
// Date labels are inline, non-interactive rows rather than separate labeled sections, so
// the customize menu shows exactly one "Sessions" toggle and no per-date entries.
const buildSessionRows = (sessions: DashboardSession[], target: SessionNodeTarget): TreeNode[] => {
  if (sessions.length === 0) {
    return [{ id: "sessions-empty", label: "No sessions yet", disabled: true }];
  }
  const rows: TreeNode[] = [];
  let currentDateKey: string | undefined;
  for (const session of sessions) {
    const lastActivityAt = new Date(session.lastActivityAt);
    const dateKey = getDateKey(lastActivityAt);
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      rows.push({ id: `sessions-date-${dateKey}`, label: getSessionDateLabel(lastActivityAt), disabled: true });
    }
    rows.push(createSessionNode(session, target));
  }
  return rows;
};
const createSessionGroupAction = (workspace: ResourceRef | undefined) => ({
  id: "sessions.create",
  label: "New session",
  icon: "Plus",
  commandId: dashboardCommandIds.createSession,
  ...(workspace ? { args: { workspace } } : {}),
});
// The Sessions level owns the whole sidenav body, so its rows sit directly in one fixed section.
export const buildSessionsLevelSections = (sessions: DashboardSession[]): TreeViewSection[] => [
  {
    id: "session-list",
    label: "Sessions",
    collapsible: false,
    actions: [createSessionGroupAction(undefined)],
    nodes: buildSessionRows(sessions, "resource"),
  },
];
// Inside project navigation, a workspace's sessions stay one collapsible group next to other sections.
export const buildWorkspaceSessionsSections = (
  sessions: DashboardSession[],
  workspace?: ResourceRef,
): TreeViewSection[] => {
  const workspaceId = getWorkspaceResourceId(workspace);
  const workspaceSessions = workspaceId ? sessions.filter((session) => session.workspaceId === workspaceId) : sessions;
  return [
    {
      id: "sessions-wrap",
      nodes: [
        {
          id: "workspace-sessions",
          label: "Sessions",
          canHide: true,
          collapsible: true,
          actions: [createSessionGroupAction(workspace)],
          children: buildSessionRows(workspaceSessions, "side"),
        },
      ],
    },
  ];
};
