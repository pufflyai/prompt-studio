import type { SessionMessage } from "pstdio-api-contracts";
import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import { publishSessionContent } from "./session-content-publications";
import { loadSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";

type InitializationDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService" | "harnessRegistry"> &
  Partial<Pick<SessionsRouteDeps, "workspaceSessionService" | "sessionQueueEntriesService">>;

export const initializeConversation = (
  sessionId: string,
  deps: InitializationDeps,
  prepare: () => Promise<unknown>,
  signal?: AbortSignal,
  recovery: "continuation" | "reattach" = "continuation",
) => {
  let lastIdleReply: string | undefined;
  const publish = (action: () => Promise<unknown>) => {
    const pending = publishSessionContent(entry, async () => {
      if (deps.sessionService.store.get(sessionId) === entry && !entry.conversation?.closed) return action();
    });
    void pending.catch((err) =>
      sessionLogger.error({ err, session_id: sessionId }, "Could not persist session content position"),
    );
    return pending;
  };
  const entry = deps.sessionService.store.create(
    sessionId,
    {
      onIdleReply: (reply) => {
        if (deps.sessionService.store.get(sessionId) !== entry) return;
        const key = JSON.stringify([reply.id, reply.textDigest]);
        if (lastIdleReply === key || !entry.conversation) return;
        lastIdleReply = key;
        const messages = structuredClone(entry.conversation.getMessages());
        void publish(() => persistSessionMessages(sessionId, messages, deps, reply)).catch(() => {
          if (lastIdleReply === key) lastIdleReply = undefined;
        });
      },
      onApprovalRequest: (request) => {
        if (deps.sessionService.store.get(sessionId) !== entry) return;
        void publish(() =>
          deps.sessionService.update(sessionId, { contentEvent: { kind: "input", id: request.id } }),
        ).catch(() => undefined);
        entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
      },
      // Status is host-owned: the harness only reports that it is waiting for the person.
      onQuestionAsked: async (id) => {
        if (deps.sessionService.store.get(sessionId) !== entry) return;
        await publish(() => deps.sessionService.update(sessionId, { contentEvent: { kind: "input", id } })).catch(
          () => undefined,
        );
        await deps.sessionService.transitionStatus(sessionId, "awaiting_input", { expectedOwner: entry });
      },
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
      const history = await loadSessionHistory(
        sessionId,
        deps,
        retained,
        recovery === "reattach"
          ? (reply) => {
              entry.initialReply = reply ?? null;
            }
          : undefined,
      );
      signal?.throwIfAborted();
      return history;
    },
  );
  return entry;
};
