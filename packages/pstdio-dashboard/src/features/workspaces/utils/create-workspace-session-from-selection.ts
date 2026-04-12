import { resolveCreateWorkspaceSessionInput } from "./create-workspace-session-input";

interface WorkspaceAttemptRef {
  id: string;
  shorthand: string;
}

interface CreateWorkspaceSessionFromSelectionInput {
  attempts: WorkspaceAttemptRef[];
  workspaceShorthand: string;
  ticketShorthand: string;
  lastSelectedAgent: string | null;
  lastSelectedModels: string[];
  createWorkspaceSession: (input: {
    workspaceId: string;
    prompt: string;
    agent: string;
    model: string | null;
  }) => Promise<{ sessionId: string }>;
  onCreated: (sessionId: string) => void;
}

export const createWorkspaceSessionFromSelection = async (input: CreateWorkspaceSessionFromSelectionInput) => {
  const sessionInput = resolveCreateWorkspaceSessionInput(input);
  if (!sessionInput) return;

  const result = await input.createWorkspaceSession(sessionInput);
  input.onCreated(result.sessionId);
};
