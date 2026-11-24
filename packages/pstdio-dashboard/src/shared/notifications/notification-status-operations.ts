import {
  classifyApiWrite,
  getWorkbenchOperations,
  resourceOperationSubject,
  type WorkbenchOperations,
} from "@pstdio/workbench";
import type { Notification } from "pstdio-api-contracts";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

const domain = "notification.status";
type NotificationStatus = "read" | "dismissed" | "done";
const statusTitles = {
  read: "Mark notification as read",
  dismissed: "Dismiss notification",
  done: "Resolve notification",
} satisfies Record<NotificationStatus, string>;

interface NotificationIntent {
  id: string;
  status: NotificationStatus;
}

const noPatches = new Map<string, NotificationStatus>();

const equalStatusPatches = (first: Map<string, NotificationStatus>, next: Map<string, NotificationStatus>) =>
  first.size === next.size && [...first].every(([id, status]) => next.get(id) === status);

const collectStatusPatches = (
  pending: ReturnType<WorkbenchOperations["getSnapshot"]>["pending"],
  previous: Map<string, Map<string, NotificationStatus>>,
) => {
  const patches = new Map<string, Map<string, NotificationStatus>>();
  for (const entry of pending) {
    if (entry.domain !== domain || !entry.projectId || !entry.intent) continue;
    const project = patches.get(entry.projectId) ?? new Map();
    const { id, status } = entry.intent as NotificationIntent;
    project.set(id, status);
    patches.set(entry.projectId, project);
  }
  for (const [id, status] of patches) {
    const before = previous.get(id);
    if (before && equalStatusPatches(before, status)) patches.set(id, before);
  }
  return patches;
};

export const getNotificationStatusOperations = createRuntimeState((owner) => {
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).notifications;
  let snapshot: ReturnType<typeof operations.getSnapshot> | undefined;
  let patches = new Map<string, Map<string, NotificationStatus>>();

  const readPatches = (projectId?: string) => {
    if (!projectId) return noPatches;
    const latest = operations.getSnapshot();
    if (snapshot !== latest) {
      snapshot = latest;
      patches = collectStatusPatches(latest.pending, patches);
    }
    return patches.get(projectId) ?? noPatches;
  };

  const update = async (notification: Pick<Notification, "id" | "projectId" | "title">, status: NotificationStatus) => {
    const { projectId, id, title } = notification;
    const read = () => owner.getCollection("notifications").state.get(id);
    const verify = async (signal: AbortSignal) => {
      const notification = await api.get(projectId, id, { signal });
      if (notification.id !== id || notification.projectId !== projectId)
        throw new SyntaxError("The server returned a different notification.");
      return notification;
    };
    const resource = { projectId, id, type: "notification", extensionId: "pstdio", label: title };
    const accept = (confirmed: Notification) => {
      const row = read();
      if (!row || row.project_id !== projectId) return;
      owner.getWriter("notifications")?.upsert({
        ...row,
        status: confirmed.status,
        updated_at: confirmed.updatedAt,
        read_at: confirmed.readAt,
        resolved_at: confirmed.resolvedAt,
      });
    };
    return operations.submit({
      domain,
      projectId,
      subjects: [resourceOperationSubject(resource)],
      sourceCommand: { id: dashboardCommandIds.openNotifications },
      title: statusTitles[status],
      intent: { id, status } satisfies NotificationIntent,
      draft: { id, title, status },
      async write(signal) {
        const row = read();
        if (row?.project_id === projectId && row.status === "expired") throw new Error("This notification expired.");
        const result = await api.setStatus(projectId, id, { status }, { signal });
        if (!result) throw new Error("This notification is no longer available.");
        return result;
      },
      async reconcile(_saved, signal) {
        const before = read();
        const confirmed = await verify(signal);
        signal.throwIfAborted();
        if (before === read()) accept(confirmed);
      },
      async check(signal) {
        const before = read();
        const confirmed = await verify(signal);
        if (confirmed.status === status) return { status: "confirmed", result: confirmed };
        if (confirmed.status === "expired") {
          signal.throwIfAborted();
          if (before === read()) accept(confirmed);
          return { status: "rejected", error: new Error("This notification expired.") };
        }
        return { status: "unknown" };
      },
      classify: classifyApiWrite,
    }).result;
  };

  return {
    readPatches,
    subscribe: operations.subscribe,
    update,
    updateById(projectId: string, id: string, status: NotificationStatus) {
      const row = owner.getCollection("notifications").state.get(id);
      const title = row?.project_id === projectId && typeof row.title === "string" ? row.title : "Notification";
      return update({ id, projectId, title }, status);
    },
  };
});
