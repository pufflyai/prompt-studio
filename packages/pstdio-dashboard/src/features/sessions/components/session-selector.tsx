import { Box, Button, Menu, Text } from "@chakra-ui/react";
import type { SessionCompletionStatus } from "@pstdio/ui";
import { MenuItem, SessionIndicator } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Session } from "../types";
import { getRecentSessions } from "../utils/recent-sessions";
import { getSessionsRoutePath } from "../utils/sessions-route";

const SESSION_DROPDOWN_LIMIT = 6;

interface SessionSelectorProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export const SessionSelector = (props: SessionSelectorProps) => {
  const { sessions, selectedSessionId, onSelectSession } = props;
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const recentSessions = getRecentSessions(sessions, SESSION_DROPDOWN_LIMIT);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const label = selectedSession?.title ?? t("sessions.newSession");

  const handleViewMoreSessions = () => {
    const path = getSessionsRoutePath(projectId, selectedSessionId);
    if (!path) return;
    navigate({ to: path });
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" px="2" maxW="10rem">
          <SessionIndicator status={selectedSession?.status as SessionCompletionStatus} />
          <Text textStyle="label/XS/medium" color="fg" lineClamp={1} ml="2xs">
            {label}
          </Text>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="bg">
          <Box maxH="14rem" overflowY="auto" py="1">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <MenuItem
                  key={session.id}
                  id={session.id}
                  primaryLabel={session.title}
                  tooltipLabel={session.title}
                  leftSlot={<SessionIndicator status={session.status as SessionCompletionStatus} />}
                  variant="compact"
                  isSelected={session.id === selectedSessionId}
                  onClick={() => onSelectSession(session.id)}
                />
              ))
            ) : (
              <MenuItem primaryLabel={t("sessions.noSessionsYet")} isDisabled />
            )}
          </Box>
          <Box borderTopWidth="1px" px="1" py="1">
            <Button variant="ghost" size="xs" width="full" justifyContent="flex-start" onClick={handleViewMoreSessions}>
              {t("chatInput.session.viewMore")}
            </Button>
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
