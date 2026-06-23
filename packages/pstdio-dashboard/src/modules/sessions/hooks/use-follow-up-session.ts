import type { ChatInputQuestionResponse } from "@pstdio/ui/chat-ui";
import { useMutation } from "@tanstack/react-query";
import type { SessionAttachment } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";

interface FollowUpInput {
  sessionId: string;
  prompt: string;
  agent?: string;
  model?: string;
  questionResponse?: ChatInputQuestionResponse;
  attachments?: SessionAttachment[];
}

type FollowUpDecision = { status: "dispatched" } | { status: "queued"; queue_position: number };

type FollowUpResponse = { status: string; follow_up?: FollowUpDecision };

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
          attachments: input.attachments?.map((attachment) => ({ file_id: attachment.file_id })),
        },
      });
      return { status: response.status, followUp: response.follow_up };
    },
  });
