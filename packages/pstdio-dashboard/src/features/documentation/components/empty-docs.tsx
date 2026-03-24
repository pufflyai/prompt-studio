import { toaster } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { useCreateProjectSession } from "@/features/sessions/hooks/use-create-project-session";
import { logMutationError } from "@/lib/error-handlers";
import { EmptyDocsContent } from "./empty-docs-content";

export const EmptyDocs = () => {
  const { t } = useTranslation();
  const { projectId } = useParams({ strict: false });
  const createSession = useCreateProjectSession();
  const lastSelectedAgent = useProjectSettingsStore((state) => state.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((state) => state.lastSelectedModels);
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);

  const handleSelectPrompt = async (prompt: string) => {
    if (typeof projectId !== "string" || createSession.isPending) {
      return;
    }

    try {
      const { sessionId } = await createSession.mutateAsync({
        projectId,
        prompt,
        agent: lastSelectedAgent,
        model: lastSelectedModels[0] ?? undefined,
      });

      setSelectedSessionId(sessionId);
      setSessionModalState("bubble");
    } catch (error) {
      logMutationError("start documentation session", error);
      toaster.create({
        type: "error",
        title: t("states.error"),
        description: t("docs.empty.startSessionError"),
      });
    }
  };

  return (
    <EmptyDocsContent
      canStartSession={typeof projectId === "string"}
      pendingPrompt={createSession.isPending ? (createSession.variables?.prompt ?? null) : null}
      onSelectPrompt={handleSelectPrompt}
    />
  );
};
