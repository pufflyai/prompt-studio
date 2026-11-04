import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { sharedQueue } from "./queue-snapshot";
import type { createHistoryReferences } from "./references";
import type { PersonalDevice, PersonalHistoryStore } from "./store";

export const capturePersonalHistory = async (input: {
  projectId: string;
  device: PersonalDevice;
  history: PersonalHistoryStore;
  references: ReturnType<typeof createHistoryReferences>;
  deps: Pick<
    ExtensionsRouteDeps,
    "workspaceService" | "sessionService" | "workspaceSessionService" | "sessionQueueEntriesService"
  >;
}) => {
  const { deps, history, device, projectId, references } = input;
  const localWorkspaces = await deps.workspaceService.listForProviderReconciliation(projectId);
  const localSessions = (await deps.sessionService.query(projectId, { includeArchived: true }, { unpaged: true })).rows;
  const workspaceIds = await history.claimLocalRecords(
    "workspaces",
    localWorkspaces.map((row) => row.id),
  );
  const sessionIds = await history.claimLocalRecords(
    "sessions",
    localSessions.map((row) => row.id),
  );
  const workspaces = localWorkspaces.filter((row) => workspaceIds.has(row.id));
  const sessions = localSessions.filter((row) => sessionIds.has(row.id));
  await history.writeRecords("workspaces", device, workspaces);
  await history.writeRecords(
    "sessions",
    device,
    sessions.map((session) => ({
      ...session,
      approval_requests: deps.sessionService.store.get(session.id)?.approvalService.pendingRequests() ?? [],
    })),
  );
  const queued = new Map<string, Awaited<ReturnType<typeof deps.sessionQueueEntriesService.listUndispatched>>>();
  for (const entry of await deps.sessionQueueEntriesService.listUndispatched()) {
    if (!sessionIds.has(entry.session_id)) continue;
    const entries = queued.get(entry.session_id) ?? [];
    entries.push(entry);
    queued.set(entry.session_id, entries);
  }
  // Only sessions with queued messages have a record; a drained queue's record is removed.
  const queues = [...queued].map(([id, entries]) => ({ id, requests: sharedQueue(entries) }));
  await history.writeRecords(
    "queues",
    device,
    queues.filter((queue) => queue.requests.length),
  );
  const links = (await deps.workspaceSessionService.listLinks(projectId)).filter(
    (link) => workspaceIds.has(link.workspace_id) && sessionIds.has(link.session_id),
  );
  await history.writeRecords("workspace_sessions", device, links);
  await references.write(device, [
    ...workspaces.map((row) => ({ type: "workspace" as const, id: row.id })),
    ...sessions.map((row) => ({ type: "session" as const, id: row.id })),
  ]);
  // The sessions this account owns here. Their conversations are published as logs.
  return sessionIds;
};

/** Session events carry IDs: read and append only those rows, independent of saved project size. */
export const captureSessionChanges = async (input: Parameters<typeof capturePersonalHistory>[0], ids: string[]) => {
  const { history, device, deps, projectId, references } = input;
  const claimed = await history.claimLocalRecords("sessions", ids);
  const present = new Set<string>();
  for (const id of claimed) {
    const row = await deps.sessionService.get(id);
    if (!row || row.project_id !== projectId) {
      await history.patchRecords("sessions", device, [], [id]);
      await history.patchRecords("queues", device, [], [id]);
      await references.remove("session", id);
      continue;
    }
    present.add(id);
    const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(id);
    const workspaceId = workspace?.project_id === row.project_id ? workspace.id : null;
    await history.patchRecords("sessions", device, [
      {
        ...row,
        workspace_id: workspaceId,
        approval_requests: deps.sessionService.store.get(id)?.approvalService.pendingRequests() ?? [],
      },
    ]);
    const requests = sharedQueue(await deps.sessionQueueEntriesService.listUndispatchedBySession(id));
    await history.patchRecords(
      "queues",
      device,
      requests.length ? [{ id, requests }] : [],
      requests.length ? [] : [id],
    );
    await references.set({ type: "session", id, device });
  }
  return present;
};
