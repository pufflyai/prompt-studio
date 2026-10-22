import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { getSessionHistory } from "../../features/sessions/session-history";
import type { createHistoryReferences } from "./references";
import type { PersonalDevice, PersonalHistoryStore } from "./store";

export const capturePersonalHistory = async (input: {
  projectId: string;
  device: PersonalDevice;
  history: PersonalHistoryStore;
  references: ReturnType<typeof createHistoryReferences>;
  deps: Pick<
    ExtensionsRouteDeps,
    "workspaceService" | "sessionService" | "fileService" | "harnessRegistry" | "workspaceSessionService"
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
  for (const session of sessions) {
    // The accepted live conversation is harness-neutral and includes messages not checkpointed yet.
    await history.writeTranscript(session.id, await getSessionHistory(session.id, deps));
  }
  await history.writeRecords("sessions", device, sessions);
  const links = (await deps.workspaceSessionService.listLinks(projectId)).filter(
    (link) => workspaceIds.has(link.workspace_id) && sessionIds.has(link.session_id),
  );
  await history.writeRecords("workspace_sessions", device, links);
  await references.write(device, [
    ...workspaces.map((row) => ({ type: "workspace" as const, id: row.id })),
    ...sessions.map((row) => ({ type: "session" as const, id: row.id })),
  ]);
};
