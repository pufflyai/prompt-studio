import type { ChatInputQuestionResponse } from "@pstdio/ui/chat-ui";
import type { SessionAttachment } from "pstdio-api-contracts";

type Send = (
  text: string,
  attachments: SessionAttachment[],
  response?: ChatInputQuestionResponse,
  onSubmitted?: () => void,
) => Promise<void>;
export const sessionDraftSubmission =
  (send: Send, attachments: SessionAttachment[], onSubmitted: () => void) =>
  (text: string, _resources: string[], response?: ChatInputQuestionResponse) =>
    send(text, response ? [] : attachments, response, response ? undefined : onSubmitted);
