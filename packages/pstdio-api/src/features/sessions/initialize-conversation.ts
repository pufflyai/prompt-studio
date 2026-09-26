import type { ApprovalRequest, SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import { loadSessionHistory, SessionHistoryError } from "./session-history";

type InitializationDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService" | "harnessRegistry"> &
  Partial<Pick<SessionsRouteDeps, "workspaceSessionService">>;

export const initializeConversation = (
  sessionId: string,
  deps: InitializationDeps,
  prepare: () => Promise<unknown>,
  signal?: AbortSignal,
) => {
  const entry = deps.sessionService.store.create(
    sessionId,
    (request: ApprovalRequest) => {
      entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
    },
    async (previous) => {
      let retained: SessionMessage[] | undefined;
      if (previous) {
        await previous.session?.stop();
        await previous.checkpointPromise?.catch(() => undefined);
        const old = await previous.conversationReady;
        old.close();
        retained = old.getMessages();
        await checkpointConversation(sessionId, previous, deps);
        previous.approvalService.dispose();
      }
      await prepare();
      signal?.throwIfAborted();
      const history = await loadSessionHistory(sessionId, deps, retained);
      signal?.throwIfAborted();
      if (history.historyIssue && history.historyIssue.code !== "native_unavailable")
        throw new SessionHistoryError(history.historyIssue);
      return history.messages;
    },
  );
  return entry;
};
