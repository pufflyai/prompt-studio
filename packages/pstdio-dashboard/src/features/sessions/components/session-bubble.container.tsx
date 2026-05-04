import { IconButton } from "@chakra-ui/react";
import { BubbleButton, BubblePanel, Tooltip } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { MessageCircle, PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { SessionChatView } from "./session-chat-view";
import { SessionSelector } from "./session-selector";

export const SessionBubbleContainer = () => {
  const { t } = useTranslation("projects");
  const { projectId, workspaceShorthand } = useParams({ strict: false });
  const sessionModalState = useProjectSettingsStore((s) => s.sessionModalState);
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const selectedSessionId = useProjectSettingsStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);
  const pendingWorkspaceSessionWorkspaceId = useProjectSettingsStore((s) => s.pendingWorkspaceSessionWorkspaceId);
  const isWorkspaceRoute = typeof workspaceShorthand === "string" && workspaceShorthand.length > 0;

  const { data: sessions = [] } = useProjectSessions(projectId);

  if (sessionModalState === "closed") {
    return (
      <BubbleButton
        aria-label={t("chatInput.ariaLabel")}
        tooltip={t("chatInput.ariaLabel")}
        onClick={() => setSessionModalState("bubble")}
      >
        <MessageCircle size={20} strokeWidth={2} />
      </BubbleButton>
    );
  }

  if (sessionModalState === "attached") {
    return null;
  }

  return (
    <BubblePanel
      isOpen
      aria-label={t("chatInput.ariaLabel")}
      testId="session-bubble"
      onClose={() => setSessionModalState("closed")}
      closeLabel={t("chatInput.closeLabel")}
      onPopOut={() => setSessionModalState("attached")}
      popOutLabel="Attach panel"
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
        newSessionWorkspaceId={isWorkspaceRoute ? (pendingWorkspaceSessionWorkspaceId ?? undefined) : undefined}
        onSessionCreated={setSelectedSessionId}
        showWorkspaceHub={!isWorkspaceRoute}
        autoFocusChatInput
      />
    </BubblePanel>
  );
};
