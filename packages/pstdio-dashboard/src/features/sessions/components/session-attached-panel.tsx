import { Flex, IconButton, Spacer } from "@chakra-ui/react";
import { AttachedPanel, Header, Tooltip } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { Minimize2, PenBox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { useProjectSessions } from "../hooks/use-project-sessions";
import { SessionChatView } from "./session-chat-view";
import { SessionSelector } from "./session-selector";

export const SessionAttachedPanel = () => {
  const { t } = useTranslation("projects");
  const { projectId, workspaceShorthand } = useParams({ strict: false });
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const selectedSessionId = useProjectSettingsStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);
  const pendingWorkspaceSessionWorkspaceId = useProjectSettingsStore((s) => s.pendingWorkspaceSessionWorkspaceId);
  const isWorkspaceRoute = typeof workspaceShorthand === "string" && workspaceShorthand.length > 0;

  const { data: sessions = [] } = useProjectSessions(projectId);

  return (
    <AttachedPanel
      data-testid="session-attached-panel"
      resizable
      header={
        <Header variant="main" flexShrink={0}>
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
          <Spacer />
          <Tooltip content="Detach panel">
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Detach panel"
              onClick={() => setSessionModalState("bubble")}
            >
              <Minimize2 size={16} />
            </IconButton>
          </Tooltip>
        </Header>
      }
    >
      <Flex flex="1" minH={0} direction="column">
        <SessionChatView
          sessionId={selectedSessionId}
          newSessionWorkspaceId={isWorkspaceRoute ? (pendingWorkspaceSessionWorkspaceId ?? undefined) : undefined}
          onSessionCreated={setSelectedSessionId}
          showWorkspaceHub={!isWorkspaceRoute}
        />
      </Flex>
    </AttachedPanel>
  );
};
