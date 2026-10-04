import type { ChatInputQuestionResponse } from "@pstdio/ui/chat-ui";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { PendingFollowUpState } from "./session-chat-state";

interface UnsentActionsInput {
  clear: () => void;
  send: (text: string, attachments: SessionAttachment[], response?: ChatInputQuestionResponse) => Promise<void>;
  restore: (text: string, attachments: SessionAttachment[]) => void;
}
export const sessionUnsentActions = (unsent: PendingFollowUpState, input: UnsentActionsInput) => ({
  onRetry: () => {
    input.clear();
    void input.send(unsent.prompt, unsent.attachments ?? [], unsent.questionResponse).catch(() => {});
  },
  onClose: () => {
    input.clear();
    if (!unsent.questionResponse) input.restore(unsent.prompt, unsent.attachments ?? []);
  },
});
