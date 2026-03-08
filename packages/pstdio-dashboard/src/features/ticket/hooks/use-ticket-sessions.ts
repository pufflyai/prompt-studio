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

  const setWorkspacePanelMode = useWorkspaceStore((s) => s.setWorkspacePanelMode);
  const startOptimisticSession = useWorkspaceStore((s) => s.startOptimisticSession);
  const resolveOptimisticSession = useWorkspaceStore((s) => s.resolveOptimisticSession);
  const openWithSession = useWorkspaceStore((s) => s.openWithSession);
  const clearOptimisticSession = useWorkspaceStore((s) => s.clearOptimisticSession);
  const selectedAgent = useWorkspaceStore((s) => s.selectedAgent);
  const selectedModel = useWorkspaceStore((s) => s.selectedModel);
  const selectedBranch = useWorkspaceStore((s) => s.selectedBranch);

  const startSession = async (prompt: string) => {
    if (!projectId || createSession.isPending) return false;
    try {
      setWorkspacePanelMode("floating");
      startOptimisticSession(prompt, 0);
      const result = await createSession.mutateAsync({
        prompt,
        agent: selectedAgent,
        repoId: defaultRepoId,
        branch: "",
      });
      resolveOptimisticSession(result.sessionId);
      openWithSession(result.sessionId);
      return true;
    } catch (error) {
      clearOptimisticSession();
      logMutationError("start session", error);
      return false;
    }
  };

  const runAttempt = async (ticketId: string, prompt: string) => {
    if (!projectId || createAttempt.isPending) return false;
    const branch = selectedBranch.trim() ? selectedBranch : null;
    const model = selectedModel.trim() ? selectedModel : null;
    try {
      setWorkspacePanelMode("floating");
      startOptimisticSession(prompt, 0);
      const result = await createAttempt.mutateAsync({
        ticketId,
        agent: selectedAgent,
        repoId: defaultRepoId,
        branch,
        model,
        prompt: prompt.length > 0 ? prompt : null,
      });
      resolveOptimisticSession(result.sessionId);
      openWithSession(result.sessionId);
      return true;
    } catch (error) {
      clearOptimisticSession();
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
