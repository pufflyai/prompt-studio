import { buildImplementTicketPrompt } from "@/features/ticket/utils/build-prompts";

interface WorkspaceAttemptRef {
  id: string;
  shorthand: string;
}

interface ResolveCreateWorkspaceSessionInput {
  attempts: WorkspaceAttemptRef[];
  workspaceShorthand: string;
  ticketShorthand: string;
  lastSelectedAgent: string | null;
  lastSelectedModels: string[];
}

export const resolveCreateWorkspaceSessionInput = (input: ResolveCreateWorkspaceSessionInput) => {
  const workspace = input.attempts.find((attempt) => attempt.shorthand === input.workspaceShorthand);
  if (!workspace) return null;

  const model = input.lastSelectedModels[0]?.trim() ? input.lastSelectedModels[0] : null;

  return {
    workspaceId: workspace.id,
    prompt: buildImplementTicketPrompt(input.ticketShorthand),
    agent: input.lastSelectedAgent ?? "opencode",
    model,
  };
};
