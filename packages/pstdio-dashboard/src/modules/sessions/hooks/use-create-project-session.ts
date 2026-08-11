import { useMutation } from "@tanstack/react-query";
import type { SessionAttachment } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import type { HarnessParamValues } from "../components/harness-param-values";

interface CreateProjectSessionInput {
  projectId: string;
  prompt: string;
  agent: string;
  attachments?: SessionAttachment[];
  model?: string;
  params?: HarnessParamValues;
  workspaceId?: string;
}

type CreateProjectSessionResponse = { id: string; status: string };

const buildCreateProjectSessionBody = (input: CreateProjectSessionInput) => ({
  project_id: input.projectId,
  title: input.prompt.slice(0, 100),
  prompt: input.prompt,
  agent: input.agent,
  attachments: input.attachments?.map((attachment) => ({ file_id: attachment.file_id })),
  model: input.model?.trim() || undefined,
  params: input.params,
  workspace_id: input.workspaceId,
});

export const useCreateProjectSession = () =>
  useMutation({
    mutationFn: async (input: CreateProjectSessionInput) => {
      const response = await apiRequest<CreateProjectSessionResponse>("/v1/sessions", {
        method: "POST",
        body: buildCreateProjectSessionBody(input),
      });

      return { sessionId: response.id, status: response.status };
    },
  });
