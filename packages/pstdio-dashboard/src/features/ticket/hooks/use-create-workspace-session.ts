import { apiRequest } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

interface CreateWorkspaceSessionInput {
  prompt: string;
  agent: string;
  repoId: string | null;
  branch: string;
  model?: string | null;
}

interface CreateWorkspaceSessionResult {
  sessionId: string;
}

export const useCreateWorkspaceSession = (projectId: string | undefined) =>
  useMutation(async (input: CreateWorkspaceSessionInput) => {
    if (!projectId) throw new Error("Project id is required to create a workspace session.");

    const response = await apiRequest<{ id: string }>("/v1/sessions", {
      method: "POST",
      body: {
        project_id: projectId,
        title: input.prompt.slice(0, 100),
        prompt: input.prompt,
        agent: input.agent,
        model: input.model ?? undefined,
      },
    });

    return { sessionId: response.id } satisfies CreateWorkspaceSessionResult;
  });
