import type { SessionMessageSender } from "pstdio-api-contracts";
import { submittedMessageSender } from "./submitted-message-identity";

export const prepareSubmittedSender = async (
  conversation: import("./session-conversation").SessionConversation,
  input: { sessionId: string; prompt: string; submittedQueuePosition?: number; sender?: SessionMessageSender },
  deps: Pick<import("./deps").SessionsRouteDeps, "sessionService"> & {
    sessionQueueEntriesService?: import("./deps").SessionsRouteDeps["sessionQueueEntriesService"];
  },
) => {
  if (!input.sender) return;
  const queue = deps.sessionQueueEntriesService;
  let afterTurn: number | undefined;
  if (queue && input.submittedQueuePosition !== undefined) {
    const count = conversation.getMessages().filter((message) => message.role === "user").length;
    const session = await deps.sessionService.get(input.sessionId);
    if (!session?.last_request_started) throw new Error("Submitted request has no active run.");
    const boundary = await queue.setDispatchSenderBoundary(
      input.submittedQueuePosition,
      count,
      session.last_request_started,
    );
    if (!boundary?.created) throw new Error("Submitted request was already prepared or is no longer available.");
    afterTurn = boundary.entry.sender_json?.afterTurn;
  }
  conversation.attributePrompt(input.prompt, submittedMessageSender(input), undefined, afterTurn);
};
