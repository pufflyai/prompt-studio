import type { TreeNode, TreeViewSection } from "@pstdio/workbench/core";
import { createDashboardSessions, type DashboardSession } from "./data/dashboard-sessions";

interface BuildSessionsSidenavSectionsInput {
  sessions: DashboardSession[];
}

interface CreateSessionsSidenavSectionsInput {
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

const createSessionNode = (session: DashboardSession): TreeNode => ({
  id: session.resource.uri,
  label: session.title,
  icon: sessionStatusIcon(session.status),
  iconColor: sessionStatusColor(session.status),
  resource: session.resource,
});

// Sessions render as the children of a single "Sessions" group node. Date labels are
// inline, non-interactive rows inside the group rather than separate labeled sections, so
// the customize menu shows exactly one "Sessions" toggle and no per-session/per-date entries.
const buildSessionGroupChildren = (sessions: DashboardSession[]): TreeNode[] => {
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

    children.push(createSessionNode(session));
  }

  return children;
};

export const buildSessionsSidenavSections = (input: BuildSessionsSidenavSectionsInput): TreeViewSection[] => {
  return [
    {
      id: "sessions-wrap",
      nodes: [
        {
          id: "sessions",
          label: "Sessions",
          collapsible: true,
          children: buildSessionGroupChildren(input.sessions),
        },
      ],
    },
  ];
};

export const createSessionsSidenavSections = (input: CreateSessionsSidenavSectionsInput): TreeViewSection[] =>
  buildSessionsSidenavSections({
    sessions: createDashboardSessions(input.projectId),
  });
