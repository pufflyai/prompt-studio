import type { TicketAttempt } from "@/features/ticket-list/types";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";

const resolveWorkspaceActivityAt = (
  workspace: Pick<TicketAttempt, "id" | "updatedAt">,
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>,
) => {
  return (sessionsByWorkspaceId.get(workspace.id) ?? []).at(-1)?.createdAt ?? workspace.updatedAt;
};

export const sortWorkspacesByLatestSession = (
  workspaces: TicketAttempt[],
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>,
) => {
  return [...workspaces].sort((left, right) => {
    const rightActivityAt = resolveWorkspaceActivityAt(right, sessionsByWorkspaceId);
    const leftActivityAt = resolveWorkspaceActivityAt(left, sessionsByWorkspaceId);
    const activityOrder = rightActivityAt.localeCompare(leftActivityAt);

    if (activityOrder !== 0) {
      return activityOrder;
    }

    return left.shorthand.localeCompare(right.shorthand);
  });
};
