import { Button, Icon, Menu, Text } from "@chakra-ui/react";
import type { SessionCompletionStatus } from "@pstdio/ui";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  ScrollArea,
  SessionIndicator,
} from "@pstdio/ui";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown } from "lucide-react";
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
  const { projectId } = useParams({ strict: false });
  const recentSessions = getRecentSessions(sessions, SESSION_DROPDOWN_LIMIT);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const label = selectedSession?.title ?? t("sessions.newSession");
  const viewMorePath = getSessionsRoutePath(projectId, selectedSessionId);

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" px="2" maxW="10rem">
          <SessionIndicator status={selectedSession?.status as SessionCompletionStatus} />
          <Text textStyle="label/XS/medium" color="fg" lineClamp={1} ml="2xs" textAlign="left">
            {label}
          </Text>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" maxW="420px" bg="bg">
          <ScrollArea maxH="14rem" contentProps={{ py: "1" }}>
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <Menu.Item key={session.id} value={session.id} asChild>
                  <ListRow
                    asChild
                    variant="compact"
                    id={session.id}
                    label={session.title}
                    tooltip={session.title}
                    icon={
                      <Icon
                        as={resolveSessionIndicatorIcon(session.status as SessionCompletionStatus)}
                        boxSize="16px"
                      />
                    }
                    iconColor={resolveSessionIndicatorColor(session.status as SessionCompletionStatus)}
                    isSelected={session.id === selectedSessionId}
                    onActivate={() => onSelectSession(session.id)}
                  />
                </Menu.Item>
              ))
            ) : (
              <Menu.Item value="empty" asChild>
                <ListRow asChild variant="compact" id="empty" label={t("sessions.noSessionsYet")} disabled />
              </Menu.Item>
            )}
          </ScrollArea>
          <Menu.Separator />
          {viewMorePath ? (
            <Menu.Item value="view-more" asChild>
              <Link to={viewMorePath}>
                <ListRow
                  asChild
                  variant="compact"
                  width="full"
                  id="view-more"
                  label={t("chatInput.session.viewMore")}
                  endContent={<Icon as={ArrowUpRight} boxSize="16px" />}
                />
              </Link>
            </Menu.Item>
          ) : null}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
