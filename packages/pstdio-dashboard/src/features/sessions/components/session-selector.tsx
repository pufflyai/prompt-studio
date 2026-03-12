import { Box, Button, Menu, Text } from "@chakra-ui/react";
import type { SessionCompletionStatus } from "@pstdio/ui";
import { MenuItem, SessionIndicator } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Session } from "../types";

interface SessionSelectorProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export const SessionSelector = (props: SessionSelectorProps) => {
  const { sessions, selectedSessionId, onSelectSession } = props;
  const { t } = useTranslation("projects");

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const label = selectedSession?.title ?? t("sessions.newSession");

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
          <Box maxH="18rem" overflowY="auto" py="1">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <MenuItem
                  key={session.id}
                  id={session.id}
                  primaryLabel={session.title}
                  tooltipLabel={session.title}
                  leftSlot={<SessionIndicator status={session.status as SessionCompletionStatus} />}
                  isSelected={session.id === selectedSessionId}
                  onClick={() => onSelectSession(session.id)}
                />
              ))
            ) : (
              <MenuItem primaryLabel={t("sessions.noSessionsYet")} isDisabled />
            )}
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
