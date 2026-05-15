import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

interface CreateSessionInput {
  projectId: string;
  prompt: string;
}

export const buildCreateSessionBody = (input: CreateSessionInput) => ({
  project_id: input.projectId,
  title: input.prompt.slice(0, 100),
  prompt: input.prompt,
});

export const useCreateSession = () =>
  useMutation({
    mutationFn: async (input: CreateSessionInput) => {
      const response = await apiRequest<{ id: string }>("/v1/sessions", {
        method: "POST",
        body: buildCreateSessionBody(input),
      });

      return { sessionId: response.id };
    },
  });
