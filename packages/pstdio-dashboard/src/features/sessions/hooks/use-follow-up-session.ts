import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { SessionAttachmentRef } from "../session-attachment-ref";

interface FollowUpInput {
  sessionId: string;
  prompt: string;
  attachments?: SessionAttachmentRef[];
  agent?: string;
  model?: string;
}

export const useFollowUpSession = () =>
  useMutation({
    mutationFn: async (input: FollowUpInput) => {
      await apiRequest(`/v1/sessions/${input.sessionId}/follow-up`, {
        method: "POST",
        body: { prompt: input.prompt, attachments: input.attachments, agent: input.agent, model: input.model },
      });
    },
  });
