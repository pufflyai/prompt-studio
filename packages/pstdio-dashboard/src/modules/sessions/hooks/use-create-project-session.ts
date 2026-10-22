import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import { useMutation } from "@tanstack/react-query";
import type { SessionAttachment } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";

interface CreateProjectSessionInput {
  projectId: string;
  prompt: string;
  agent: string;
  attachments?: SessionAttachment[];
  model?: string;
  params?: HarnessParamValues;
  workspaceId?: string;
}

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
      const response = await getApiClient().sessions.create(buildCreateProjectSessionBody(input));

      return { sessionId: response.id, status: response.status };
    },
  });
