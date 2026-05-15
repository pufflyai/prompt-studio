import type { ChatInputQuestionResponse } from "@pstdio/ui/chat-ui";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

interface FollowUpInput {
  sessionId: string;
  prompt: string;
  agent?: string;
  model?: string;
  questionResponse?: ChatInputQuestionResponse;
}

type FollowUpResponse = { status: string };

export const useFollowUpSession = () =>
  useMutation({
    mutationFn: async (input: FollowUpInput) => {
      const response = await apiRequest<FollowUpResponse>(`/v1/sessions/${input.sessionId}/follow-up`, {
        method: "POST",
        body: {
          prompt: input.prompt,
          agent: input.agent,
          model: input.model?.trim() || undefined,
          question_response: input.questionResponse,
        },
      });
      return { status: response.status };
    },
  });
