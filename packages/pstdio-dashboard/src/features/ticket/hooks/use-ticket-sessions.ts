import { useAgentStore } from "@/features/agents/state";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { useWorkspaceStore } from "@/features/workspaces/state";
import { logMutationError } from "@/lib/error-handlers";
import { useCreateWorkspaceSession } from "./use-create-workspace-session";

interface UseTicketSessionsInput {
  projectId: string | undefined;
  defaultRepoId: string | null;
}

export const useTicketSessions = (input: UseTicketSessionsInput) => {
  const { projectId, defaultRepoId } = input;
  const createSession = useCreateWorkspaceSession(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);

  const selectedBranch = useWorkspaceStore((s) => s.selectedBranch);
  const selectedAgent = useAgentStore((s) => s.selectedAgent);
  const selectedModel = useAgentStore((s) => s.selectedModel);

  const startSession = async (prompt: string) => {
    if (!projectId || createSession.isPending) return false;
    try {
      await createSession.mutateAsync({
        prompt,
        agent: selectedAgent,
        repoId: defaultRepoId,
        branch: "",
      });
      return true;
    } catch (error) {
      logMutationError("start session", error);
      return false;
    }
  };

  const runAttempt = async (ticketId: string, prompt: string) => {
    if (!projectId || createAttempt.isPending) return false;
    const branch = selectedBranch.trim() ? selectedBranch : null;
    const model = selectedModel.trim() ? selectedModel : null;
    try {
      await createAttempt.mutateAsync({
        ticketId,
        agent: selectedAgent,
        repoId: defaultRepoId,
        branch,
        model,
        prompt: prompt.length > 0 ? prompt : null,
      });
      return true;
    } catch (error) {
      logMutationError("run attempt", error);
      return false;
    }
  };

  return {
    startSession,
    runAttempt,
    isStartingSession: createSession.isPending,
    isRunningAttempt: createAttempt.isPending,
  };
};
