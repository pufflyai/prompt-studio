import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

interface CreateProjectSessionInput {
  projectId: string;
  prompt: string;
  agent: string;
  model?: string;
}

export const useCreateProjectSession = () =>
  useMutation({
    mutationFn: async (input: CreateProjectSessionInput) => {
      const response = await apiRequest<{ id: string }>("/v1/sessions", {
        method: "POST",
        body: {
          project_id: input.projectId,
          title: input.prompt.slice(0, 100),
          prompt: input.prompt,
          agent: input.agent,
          model: input.model,
        },
      });

      return { sessionId: response.id };
    },
  });
