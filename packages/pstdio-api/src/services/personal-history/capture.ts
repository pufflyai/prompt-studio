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
  const queued = new Map<string, Awaited<ReturnType<typeof deps.sessionQueueEntriesService.listUndispatched>>>();
  for (const entry of await deps.sessionQueueEntriesService.listUndispatched())
    queued.set(entry.session_id, [...(queued.get(entry.session_id) ?? []), entry]);
  await history.writeRecords(
    "sessions",
    device,
    sessions.map((row) => {
      const queue = sharedQueue(queued.get(row.id) ?? []);
      // Most sessions have no queue; leaving the field out keeps their records unchanged.
      return queue.length ? { ...row, queue } : row;
    }),
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
