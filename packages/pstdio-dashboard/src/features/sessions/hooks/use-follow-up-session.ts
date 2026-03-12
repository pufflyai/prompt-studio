import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

interface FollowUpInput {
  sessionId: string;
  prompt: string;
  agent?: string;
  model?: string;
}

export const useFollowUpSession = () =>
  useMutation({
    mutationFn: async (input: FollowUpInput) => {
      await apiRequest(`/v1/sessions/${input.sessionId}/follow-up`, {
        method: "POST",
        body: { prompt: input.prompt, agent: input.agent, model: input.model },
      });
    },
  });
