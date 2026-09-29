import { readFile } from "node:fs/promises";
import type { SessionConversationSources, SessionMessage } from "pstdio-api-contracts";
import { sessionMessageSchema } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { resolveSessionWorkspaceContext } from "./session-workspace-context";

type HistoryDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService" | "harnessRegistry"> &
  Partial<Pick<SessionsRouteDeps, "workspaceSessionService">>;

export class SessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
  }
}

export const readSessionHistorySources = async (sessionId: string, deps: HistoryDeps) => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) throw new SessionNotFoundError();
  const sources: SessionConversationSources = {
    checkpoint: null,
    native: null,
    checkpointError: null,
    nativeError: null,
  };
  const harness = await getSessionHarness(deps.harnessRegistry, session);
  let workspace: Awaited<ReturnType<typeof resolveSessionWorkspaceContext>>;
  await Promise.all([
    (async () => {
      if (!session.session_file_id) return;
      try {
        const file = await deps.fileService.get(session.session_file_id);
        if (!file) throw new Error("Checkpoint missing");
        sources.checkpoint = sessionMessageSchema.array().parse(JSON.parse(await readFile(file.storage_path, "utf8")));
      } catch {
        sources.checkpoint = null;
        sources.checkpointError = "checkpoint_unreadable";
      }
    })(),
    (async () => {
      if (!session.agent_session_id || !harness?.supportsHistory) return;
      try {
        workspace = deps.workspaceSessionService
          ? await resolveSessionWorkspaceContext(deps.workspaceSessionService, sessionId)
          : undefined;
        sources.native = await harness.getMessages(
          { agentSessionId: session.agent_session_id, cwd: session.cwd ?? undefined, workspace },
          { projectId: session.project_id ?? undefined },
        );
      } catch {
        sources.nativeError = "native_unavailable";
      }
    })(),
  ]);
  return { sources, session, harness, workspace };
};

// The saved conversation is what the user saw. Native history adds only what it lacks, and
// an unreadable source is skipped, so a session always has a history it can continue from.
export const loadSessionHistory = async (
  sessionId: string,
  deps: HistoryDeps,
  retained?: readonly SessionMessage[],
) => {
  const { sources, session, harness, workspace } = await readSessionHistorySources(sessionId, deps);
  const known = retained ? [...retained] : sources.checkpoint;
  if (!known) return sources.native ?? [];
  if (!sources.native) return known;
  const result = await harness!.recoverMessages(
    { knownMessages: known, nativeMessages: sources.native, cwd: session.cwd ?? undefined, workspace },
    { projectId: session.project_id ?? undefined },
  );
  return result.kind === "recovered" ? result.messages : known;
};

export const getSessionHistory = async (sessionId: string, deps: HistoryDeps) => {
  while (true) {
    const entry = deps.sessionService.store.get(sessionId);
    if (entry) {
      try {
        const conversation = await entry.conversationReady;
        if (deps.sessionService.store.get(sessionId) !== entry) continue;
        return conversation.getMessages();
      } catch (error) {
        if (deps.sessionService.store.get(sessionId) !== entry) continue;
        throw error;
      }
    }
    const loaded = await loadSessionHistory(sessionId, deps);
    if (!deps.sessionService.store.get(sessionId)) return loaded;
  }
};
