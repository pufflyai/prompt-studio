import { HStack, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { useSessionWorkspace } from "../hooks/use-session-workspace";
import { SessionBubble } from "./session-bubble";
import { SessionBubbleButton } from "./session-bubble-button";
import { SessionChatView } from "./session-chat-view";
import { SessionSelector } from "./session-selector";

export const SessionBubbleContainer = () => {
  const { t } = useTranslation("projects");
  const { projectId } = useParams({ strict: false });
  const sessionModalState = useProjectSettingsStore((s) => s.sessionModalState);
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const selectedSessionId = useProjectSettingsStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);
  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);

  const { data: sessions = [] } = useProjectSessions(projectId);
  const workspace = useSessionWorkspace(selectedSessionId);
  const createSession = useCreateProjectSession();

  const agent = lastSelectedAgent;
  const model = lastSelectedModels[0] ?? undefined;

  const handleCreateSession = (prompt: string) => {
    if (!projectId || !agent) return;
    createSession.mutate(
      { projectId, prompt, agent, model },
      { onSuccess: ({ sessionId }) => setSelectedSessionId(sessionId) },
    );
  };

  if (sessionModalState === "closed") {
    return <SessionBubbleButton onClick={() => setSessionModalState("bubble")} />;
  }

  if (sessionModalState === "attached") {
    return null;
  }

  return (
    <SessionBubble
      isOpen
      onClose={() => setSessionModalState("closed")}
      onPopOut={() => setSessionModalState("attached")}
      menu={
        <>
          <SessionSelector
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
          />
          <Tooltip content={t("sessions.newSession")}>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={t("sessions.newSession")}
              onClick={() => setSelectedSessionId(null)}
            >
              <PenBox size={16} />
            </IconButton>
          </Tooltip>
        </>
      }
    >
      <SessionChatView
        sessionId={selectedSessionId}
        agent={agent}
        model={model}
        onCreateSession={handleCreateSession}
        repoMenu={
          <HStack justify="space-between" align="center" wrap="wrap" w="full">
            <AgentBrowserContainer />
            <RepoBrowserContainer lockedBranch={workspace?.branch} />
          </HStack>
        }
      />
    </SessionBubble>
  );
};
