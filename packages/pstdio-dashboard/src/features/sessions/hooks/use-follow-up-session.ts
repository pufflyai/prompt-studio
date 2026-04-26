import type { ChatInputQuestionResponse } from "@pstdio/ui/chat-ui";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { SessionPromptAttachment } from "../types";

interface FollowUpInput {
  sessionId: string;
  prompt: string;
  agent?: string;
  model?: string;
  questionResponse?: ChatInputQuestionResponse;
  attachments?: SessionPromptAttachment[];
}

export const useFollowUpSession = () =>
  useMutation({
    mutationFn: async (input: FollowUpInput) => {
      await apiRequest(`/v1/sessions/${input.sessionId}/follow-up`, {
        method: "POST",
        body: {
          prompt: input.prompt,
          agent: input.agent,
          model: input.model,
          question_response: input.questionResponse,
          attachments: input.attachments,
        },
      });
    },
  });
