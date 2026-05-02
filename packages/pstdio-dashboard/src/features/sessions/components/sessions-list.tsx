import { Icon, Menu, Skeleton, Stack, Text } from "@chakra-ui/react";
import type { SessionCompletionStatus } from "@pstdio/ui";
import { ListRow, resolveSessionIndicatorColor, resolveSessionIndicatorIcon } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Session } from "../types";
import { groupSessionsByDate } from "../utils/group-sessions";

interface SessionsListProps {
  sessions: Session[];
  selectedSessionId: string | null;
  isLoading: boolean;
  projectId: string | undefined;
  onSelectSession: (sessionId: string) => void;
}

const LoadingSkeleton = () => (
  <Stack gap="xs" px="sm" py="xs">
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} height="28px" borderRadius="sm" />
    ))}
  </Stack>
);

export const SessionsList = (props: SessionsListProps) => {
  const { t } = useTranslation("projects");
  const { sessions, selectedSessionId, isLoading, projectId, onSelectSession } = props;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (sessions.length === 0) {
    return (
      <Stack px="sm" py="md" align="center">
        <Text textStyle="label/S/regular" color="foreground.secondary">
          {t("sessions.noSessionsYet")}
        </Text>
      </Stack>
    );
  }

  const groups = groupSessionsByDate(sessions);

  return (
    <Menu.Root>
      <Stack gap="xs" py="xs">
        {groups.map((group) => (
          <Stack key={group.label} gap="0">
            <Text textStyle="label/XS/medium" color="foreground.secondary" px="sm" py="2xs">
              {group.label}
            </Text>

            {group.sessions.map((session) => (
              <Menu.Item key={session.id} value={session.id} asChild>
                {projectId ? (
                  <Link to={`/projects/${projectId}/sessions/${session.id}`}>
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
                  </Link>
                ) : (
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
                )}
              </Menu.Item>
            ))}
          </Stack>
        ))}
      </Stack>
    </Menu.Root>
  );
};
