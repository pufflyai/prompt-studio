import type { SessionMessageSender } from "pstdio-api-contracts";
import { recoverMessageSenders } from "./recover-message-senders";

import { submittedMessageSender } from "./submitted-message-identity";

export const prepareSubmittedSender = async (
  conversation: import("./session-conversation").SessionConversation,
  input: { sessionId: string; prompt: string; submittedQueuePosition?: number; sender?: SessionMessageSender },
  queue?: import("./deps").SessionsRouteDeps["sessionQueueEntriesService"],
) => {
  if (!input.sender) return;
  let afterTurn: number | undefined;
  if (queue && input.submittedQueuePosition !== undefined) {
    const count = conversation.getMessages().filter((message) => message.role === "user").length;
    const entry = await queue.setDispatchSenderBoundary(input.submittedQueuePosition, count);
    if (!entry) throw new Error("Submitted request is no longer available.");
    afterTurn = entry.sender_json?.afterTurn;
    const previous = conversation.getMessages();
    const restored = recoverMessageSenders(previous, [entry]);
    if (restored.some((message, index) => message !== previous[index]))
      conversation.push({ op: "replace", path: "/messages", value: restored });
  }
  conversation.attributePrompt(input.prompt, submittedMessageSender(input), undefined, afterTurn);
};
