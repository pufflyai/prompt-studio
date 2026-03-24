import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { useProjectSessions } from "../hooks/use-project-sessions";
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

  const { data: sessions = [] } = useProjectSessions(projectId);

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
      <SessionChatView sessionId={selectedSessionId} onSessionCreated={setSelectedSessionId} />
    </SessionBubble>
  );
};
