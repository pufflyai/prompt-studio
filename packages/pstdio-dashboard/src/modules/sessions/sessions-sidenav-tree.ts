import type { ResourceRef, TreeNode, TreeViewSection } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createDashboardSessions, type DashboardSession } from "./data/dashboard-sessions";

type SessionNodeTarget = "resource" | "side";

interface BuildSessionsSidenavSectionsInput {
  sessions: DashboardSession[];
  workspace?: ResourceRef;
  nodeTarget?: SessionNodeTarget;
}

interface CreateSessionsSidenavSectionsInput extends Omit<BuildSessionsSidenavSectionsInput, "sessions"> {
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
          commandId: dashboardCommandIds.openSessionPanel,
          args: {
            resource: session.resource,
            tabPosition: "start",
          },
        } as const,
      }),
});

// Sessions render as the children of a single "Sessions" group node. Date labels are
// inline, non-interactive rows inside the group rather than separate labeled sections, so
// the customize menu shows exactly one "Sessions" toggle and no per-session/per-date entries.
const buildSessionGroupChildren = (sessions: DashboardSession[], target: SessionNodeTarget): TreeNode[] => {
  if (sessions.length === 0) {
    return [{ id: "sessions-empty", label: "No sessions yet", disabled: true }];
  }

  const children: TreeNode[] = [];
  let currentDateKey: string | undefined;

  for (const session of sessions) {
    const lastActivityAt = new Date(session.lastActivityAt);
    const dateKey = getDateKey(lastActivityAt);

    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      children.push({ id: `sessions-date-${dateKey}`, label: getSessionDateLabel(lastActivityAt), disabled: true });
    }

    children.push(createSessionNode(session, target));
  }

  return children;
};

const createSessionGroupAction = (workspace: ResourceRef | undefined) => ({
  id: "sessions.create",
  label: "New session",
  icon: "Plus",
  commandId: dashboardCommandIds.createSession,
  ...(workspace ? { args: { workspace } } : {}),
});

export const buildSessionsSidenavSections = (input: BuildSessionsSidenavSectionsInput): TreeViewSection[] => {
  const nodeTarget = input.nodeTarget ?? "resource";
  const workspaceId = getWorkspaceResourceId(input.workspace);
  const sessions = workspaceId
    ? input.sessions.filter((session) => session.workspaceId === workspaceId)
    : input.sessions;

  return [
    {
      id: "sessions-wrap",
      nodes: [
        {
          id: "sessions",
          label: "Sessions",
          ...(nodeTarget === "side" ? { canHide: true } : {}),
          collapsible: true,
          actions: [createSessionGroupAction(input.workspace)],
          children: buildSessionGroupChildren(sessions, nodeTarget),
        },
      ],
    },
  ];
};

export const createSessionsSidenavSections = (input: CreateSessionsSidenavSectionsInput): TreeViewSection[] =>
  buildSessionsSidenavSections({
    ...input,
    sessions: createDashboardSessions(input.projectId),
  });
