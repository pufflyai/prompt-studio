import { toaster } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { CodingAgent } from "@/features/agents/agent-storage";
import { useCreateTicketAttempt } from "@/features/ticket-list/hooks/use-create-ticket-attempt";
import { logMutationError } from "@/lib/error-handlers";
import { useCreateWorkspaceSession } from "./use-create-workspace-session";

interface UseTicketSessionsInput {
  projectId: string | undefined;
  defaultRepoId: string | null;
  selectedAgent: CodingAgent;
  selectedModel: string;
  selectedBranch: string;
}

export const useTicketSessions = (input: UseTicketSessionsInput) => {
  const { t } = useTranslation("tickets");
  const { projectId, defaultRepoId, selectedAgent, selectedModel, selectedBranch } = input;
  const createSession = useCreateWorkspaceSession(projectId);
  const createAttempt = useCreateTicketAttempt(projectId);

  const startSession = async (prompt: string) => {
    if (!projectId || createSession.isPending) return null;
    try {
      const result = await createSession.mutateAsync({
        prompt,
        agent: selectedAgent,
        repoId: defaultRepoId,
        branch: "",
      });
      return result.sessionId;
    } catch (error) {
      logMutationError("start session", error);
      return null;
    }
  };

  const runAttempt = async (ticketId: string, prompt: string) => {
    if (!projectId || createAttempt.isPending) return null;
    const branch = selectedBranch.trim() ? selectedBranch : null;
    const model = selectedModel.trim() ? selectedModel : null;
    try {
      const result = await createAttempt.mutateAsync({
        ticketId,
        agent: selectedAgent,
        repoId: defaultRepoId,
        branch,
        model,
        prompt: prompt.length > 0 ? prompt : null,
      });
      return result.sessionId;
    } catch (error) {
      logMutationError("run attempt", error);
      toaster.create({ type: "error", title: t("createAttemptDialog.error") });
      return null;
    }
  };

  return {
    startSession,
    runAttempt,
    isStartingSession: createSession.isPending,
    isRunningAttempt: createAttempt.isPending,
  };
};
