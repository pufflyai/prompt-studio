import type { ResourceRef, TreeNode } from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";

export type SessionNodeTarget = "resource" | "side";

export interface SessionTreeItem {
  title: string;
  status: string;
  lastActivityAt: string;
  resource: ResourceRef;
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

const createSessionNode = (session: SessionTreeItem, target: SessionNodeTarget) => ({
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

// Date labels stay inline and non-interactive so both the sessions root and a workspace
// resource expose one customizable Sessions group instead of one toggle per date.
export const buildSessionGroupChildren = (sessions: readonly SessionTreeItem[], target: SessionNodeTarget) => {
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
