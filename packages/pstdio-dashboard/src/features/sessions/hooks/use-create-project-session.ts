import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { SessionPromptAttachment } from "../types";

interface CreateProjectSessionInput {
  projectId: string;
  prompt: string;
  agent: string;
  model?: string;
  workspaceId?: string;
  attachments?: SessionPromptAttachment[];
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
          workspace_id: input.workspaceId,
          attachments: input.attachments,
        },
      });

      return { sessionId: response.id };
    },
  });
