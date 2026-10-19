import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildSessionRow } from "./auto-build-session-row";

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
  > {
  failed: boolean;
}
export function AutoBuildSessions(props: AutoBuildSessionsProps) {
  const { enabled, completed, supervisor, sessions, running, capacity, failed, error, stuck, onOpenSession, t } = props;
  const supervisorActive = ["queued", "in_progress", "awaiting_input"].includes(supervisor?.status ?? "");
  return (
    <Stack gap="md">
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
      <Stack gap="2xs">
        <Text textStyle="label/2XS/medium" color="fg.muted" textTransform="uppercase">
          {t("timeline.autoBuild.sessions", "Ongoing sessions")}
        </Text>
        {supervisor ? (
          <AutoBuildSessionRow
            session={supervisor}
            sleeping={enabled && !completed && !supervisorActive && !failed}
            onOpen={onOpenSession}
          />
        ) : (
          <Text textStyle="paragraph/S/regular">
            {enabled
              ? t("timeline.autoBuild.sleeping", "sleeping")
              : t("timeline.autoBuild.noSupervisor", "No supervisor session")}
          </Text>
        )}
      </Stack>
      <Text textStyle="label/XS" color="fg.muted">
        {t("timeline.autoBuild.running", "Running")} · {running} {t("timeline.autoBuild.capacity", "of")} {capacity}{" "}
        {t("timeline.autoBuild.agents", "agents")}
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
