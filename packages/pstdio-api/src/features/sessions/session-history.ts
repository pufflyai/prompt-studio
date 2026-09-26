import { readFile } from "node:fs/promises";
import type { SessionConversationSources, SessionHistoryIssue, SessionMessage } from "pstdio-api-contracts";
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

export class SessionHistoryError extends Error {
  constructor(readonly historyIssue: SessionHistoryIssue) {
    super("Conversation history needs review before resuming");
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
  const workspace = deps.workspaceSessionService
    ? await resolveSessionWorkspaceContext(deps.workspaceSessionService, sessionId, session.cwd ?? undefined)
    : undefined;
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

export const loadSessionHistory = async (
  sessionId: string,
  deps: HistoryDeps,
  retained?: readonly SessionMessage[],
) => {
  const { sources, session, harness, workspace } = await readSessionHistorySources(sessionId, deps);
  const saved = sources.checkpoint ?? (sources.checkpointError ? null : []);
  const known = retained ? [...retained] : saved;
  if (retained === undefined && sources.checkpoint === null && sources.nativeError) {
    throw new SessionHistoryError({ code: "native_unavailable", category: "no_readable_source" });
  }
  if (known === null && sources.native === null)
    throw new SessionHistoryError({ code: "checkpoint_unreadable", category: "no_readable_source" });
  if (known === null)
    return {
      messages: sources.native!,
      historyIssue: { code: "checkpoint_unreadable", category: "checkpoint_unreadable" } satisfies SessionHistoryIssue,
    };
  if (sources.native === null)
    return {
      messages: known,
      historyIssue: sources.nativeError
        ? ({ code: "native_unavailable", category: sources.nativeError } satisfies SessionHistoryIssue)
        : undefined,
    };
  const result = await harness!.recoverMessages(
    { knownMessages: known, nativeMessages: sources.native, cwd: session.cwd ?? undefined, workspace },
    { projectId: session.project_id ?? undefined },
  );
  if (result.kind === "conflict")
    return {
      messages: known,
      historyIssue: { code: "reconciliation_conflict", category: result.category } satisfies SessionHistoryIssue,
    };
  return { messages: result.messages, historyIssue: undefined };
};

export const getSessionHistory = async (sessionId: string, deps: HistoryDeps) => {
  while (true) {
    const entry = deps.sessionService.store.get(sessionId);
    if (entry) {
      try {
        const conversation = await entry.conversationReady;
        if (deps.sessionService.store.get(sessionId) !== entry) continue;
        return { messages: conversation.getMessages(), historyIssue: conversation.historyIssue };
      } catch (error) {
        if (deps.sessionService.store.get(sessionId) !== entry) continue;
        throw error;
      }
    }
    const loaded = await loadSessionHistory(sessionId, deps);
    if (!deps.sessionService.store.get(sessionId)) return loaded;
  }
};
