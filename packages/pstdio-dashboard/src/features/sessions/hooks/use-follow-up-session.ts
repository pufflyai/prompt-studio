import { apiRequest } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

interface FollowUpInput {
  sessionId: string;
  prompt: string;
}

export const useFollowUpSession = () =>
  useMutation(async (input: FollowUpInput) => {
    await apiRequest(`/v1/sessions/${input.sessionId}/follow-up`, {
      method: "POST",
      body: { prompt: input.prompt },
    });
  });
