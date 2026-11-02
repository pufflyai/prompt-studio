import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildSessionRow } from "./auto-build-session-row";
import { AutoBuildWaitingTickets } from "./auto-build-waiting-tickets";

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
  const {
    enabled,
    completed,
    supervisor,
    sessions,
    running,
    capacity,
    failed,
    error,
    stuck,
    onOpenSession,
    t,
    matchingTicketCount,
    readyTicketCount,
    starting,
    waitingTickets = [],
  } = props;
  return (
    <Stack gap="md">
      {enabled && !completed && !starting && matchingTicketCount === 0 ? (
        <Text textStyle="paragraph/S/regular">
          {t(
            "timeline.autoBuild.noMatchingTickets",
            "No unfinished tickets match the current scope and eligible filters. Stop Auto Build to change them, or add matching tickets.",
          )}
        </Text>
      ) : null}
      {failed || (!completed && (stuck || supervisor?.status === "awaiting_input")) ? (
        <AlertMessage
          role="alert"
          status={failed ? "error" : "warning"}
          title={
            error ??
            (failed
              ? t("timeline.autoBuild.failed", "The supervisor failed. Open its session to inspect the error.")
              : t(
                  "timeline.autoBuild.stuck",
                  "Auto Build is stuck. Check dependencies, blockers, and review requests.",
                ))
          }
        />
      ) : null}
      {enabled && !completed && !starting && running === 0 && readyTicketCount === 0 && waitingTickets.length > 0 ? (
        <AutoBuildWaitingTickets tickets={waitingTickets} t={t} />
      ) : null}
      <Text textStyle="label/2XS/medium" color="fg.muted">
        {t("timeline.autoBuild.agents", "Agents")} ({running} {t("timeline.autoBuild.capacity", "of")} {capacity})
      </Text>
      <Stack gap="2xs">
        {sessions.map((session) => (
          <AutoBuildSessionRow key={session.id} session={session} onOpen={onOpenSession} />
        ))}
        {sessions.length === 0 ? (
          <Text textStyle="label/XS" color="fg.muted">
            {t("timeline.autoBuild.noSessions", "No running ticket sessions")}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}
