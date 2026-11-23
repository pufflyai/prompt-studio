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
type NotificationStatus = "read" | "dismissed";

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

  const update = async (notification: Notification, status: NotificationStatus) => {
    const { projectId, id, title } = notification;
    const read = () => owner.getCollection("notifications").state.get(id);
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
      title: status === "read" ? "Mark notification as read" : "Dismiss notification",
      intent: { id, status } satisfies NotificationIntent,
      draft: { title, status },
      write: (signal) => api.setStatus(projectId, id, { status }, { signal }),
      async reconcile(_saved, signal) {
        const before = read();
        const confirmed = await api.get(projectId, id, { signal });
        signal.throwIfAborted();
        if (before === read()) accept(confirmed);
      },
      async check(signal) {
        const confirmed = await api.get(projectId, id, { signal });
        if (confirmed.status === status) return { status: "confirmed", result: confirmed };
        return { status: "unknown" };
      },
      classify: classifyApiWrite,
    }).result;
  };

  return { readPatches, subscribe: operations.subscribe, update };
});
