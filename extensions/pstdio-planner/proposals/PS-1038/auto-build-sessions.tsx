import { Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { AutoBuildButtonProps } from "../../src/timeline/view/auto-build-button";
import { AutoBuildSessionRow } from "../../src/timeline/view/auto-build-session-row";

interface AutoBuildSessionsProps
  extends Pick<
    AutoBuildButtonProps,
    | "enabled"
    | "completed"
    | "supervisor"
    | "sessions"
    | "running"
    | "capacity"
    | "error"
    | "stuck"
    | "onOpenSession"
    | "t"
    | "matchingTicketCount"
    | "readyTicketCount"
    | "waitingTickets"
    | "starting"
  > {
  failed: boolean;
}
export function AutoBuildSessions(props: AutoBuildSessionsProps) {
  const { sessions, running, capacity, onOpenSession, t } = props;
  return (
    <Stack gap="md">
      <Text textStyle="label/2XS/medium" color="fg.muted">
        {t("timeline.autoBuild.agents", "Agents")} ({running} {t("timeline.autoBuild.capacity", "of")} {capacity})
      </Text>
      <Stack gap="2xs">
        {sessions.map((session) => (
          <AutoBuildSessionRow key={session.id} session={session} onOpen={onOpenSession} />
        ))}
        {sessions.length === 0 ? (
          <EmptyState size="sm" title={t("timeline.autoBuild.noSessions", "No agents")} />
        ) : null}
      </Stack>
    </Stack>
  );
}
