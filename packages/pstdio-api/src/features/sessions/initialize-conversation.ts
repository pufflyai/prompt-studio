import type { SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import { loadSessionHistory } from "./session-history";

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
    {
      onApprovalRequest: (request) => {
        entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
      },
      // Status is host-owned: the harness only reports that it is waiting for the person.
      onQuestionAsked: () =>
        deps.sessionService.transitionStatus(sessionId, "awaiting_input", { expectedOwner: entry }),
      // A run that ended while the answer was in flight must stay in its terminal status.
      onQuestionAnswered: () => deps.sessionService.resume(sessionId, { expectedStatus: "awaiting_input" }),
    },
    async (previous) => {
      let retained: SessionMessage[] | undefined;
      if (previous) {
        await previous.session?.stop();
        await previous.checkpointPromise?.catch(() => undefined);
        await checkpointConversation(sessionId, previous, deps);
        const old = await previous.conversationReady;
        retained = old.getMessages();
        previous.approvalService.dispose();
        previous.questionService.dispose();
      }
      await prepare();
      signal?.throwIfAborted();
      const history = await loadSessionHistory(sessionId, deps, retained);
      signal?.throwIfAborted();
      return history;
    },
  );
  return entry;
};
