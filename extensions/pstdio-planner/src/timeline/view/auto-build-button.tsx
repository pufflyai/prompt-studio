import { Box, Button, Popover, Portal, Separator, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { type AutoBuildSession, AutoBuildSessionRow } from "./auto-build-session-row";

interface AutoBuildButtonProps {
  enabled: boolean;
  supervisor?: AutoBuildSession | null;
  sessions: AutoBuildSession[];
  running: number;
  capacity: number;
  error?: string;
  stuck?: boolean;
  disabled?: boolean;
  onConfigure: () => void;
  onTurnOff: () => Promise<boolean>;
  onOpenSession: (session: AutoBuildSession) => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildButton(props: AutoBuildButtonProps) {
  const {
    enabled,
    supervisor,
    sessions,
    running,
    capacity,
    error,
    stuck,
    disabled,
    onConfigure,
    onTurnOff,
    onOpenSession,
    t,
  } = props;
  const [open, setOpen] = useState(false);
  const failed = supervisor?.status === "failed" || Boolean(error);
  const inspectable = enabled || failed;
  let activity = "waiting";
  let color = "fg.warning";
  if (failed) {
    activity = "error";
    color = "fg.error";
  } else if (running > 0) {
    activity = "running";
    color = "fg.success";
  }
  const stop = async () => {
    if (await onTurnOff()) setOpen(false);
  };
  return (
    <Popover.Root
      size="xs"
      open={open && inspectable}
      onOpenChange={({ open }) => setOpen(inspectable && open)}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger asChild>
        <Button
          aria-label={t("timeline.autoBuild.start", "Auto Build")}
          aria-description={enabled || failed ? `Auto Build ${activity}` : undefined}
          size="2xs"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (!inspectable) onConfigure();
          }}
        >
          {enabled || failed ? (
            <Box
              role="img"
              aria-label={`Auto Build ${activity}`}
              data-activity={activity}
              boxSize="status-dot"
              rounded="full"
              bg={color}
              flexShrink="0"
            />
          ) : (
            <Play />
          )}
          {t("timeline.autoBuild.start", "Auto Build")}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            aria-label="Auto Build sessions"
            width="sm"
            maxW="calc(100vw - 2 * var(--chakra-spacing-xs))"
          >
            <Popover.Header display="flex" alignItems="center" justifyContent="space-between" gap="xs">
              <Popover.Title textStyle="label/S/medium" whiteSpace="nowrap">
                {t("timeline.autoBuild.sessions", "Running ticket sessions")} ({running}/{capacity})
              </Popover.Title>
              {enabled ? (
                <Button size="2xs" variant="outline" disabled={disabled} onClick={() => void stop()}>
                  <Pause />
                  {t("timeline.autoBuild.stop", "Stop Auto Build")}
                </Button>
              ) : (
                <Button
                  size="2xs"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    setOpen(false);
                    onConfigure();
                  }}
                >
                  <Play />
                  {t("timeline.autoBuild.start", "Auto Build")}
                </Button>
              )}
            </Popover.Header>
            <Popover.Body>
              <AutoBuildSessions
                enabled={enabled}
                supervisor={supervisor}
                sessions={sessions}
                failed={failed}
                error={error}
                stuck={stuck}
                onOpenSession={onOpenSession}
                t={t}
              />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

interface AutoBuildSessionsProps
  extends Pick<
    AutoBuildButtonProps,
    "enabled" | "supervisor" | "sessions" | "error" | "stuck" | "onOpenSession" | "t"
  > {
  failed: boolean;
}
function AutoBuildSessions(props: AutoBuildSessionsProps) {
  const { enabled, supervisor, sessions, failed, error, stuck, onOpenSession, t } = props;
  const supervisorActive = ["queued", "in_progress", "awaiting_input"].includes(supervisor?.status ?? "");
  return (
    <Stack gap="xs">
      {failed || stuck || supervisor?.status === "awaiting_input" ? (
        <AlertMessage
          role="alert"
          status={failed ? "error" : "warning"}
          title={
            error ??
            (failed
              ? t("timeline.autoBuild.failed", "The supervisor failed. Open its session to inspect the error.")
              : t(
                  "timeline.autoBuild.stuck",
                  "Auto Build is stuck. Check dependencies, blockers, and items that need attention.",
                ))
          }
        />
      ) : null}
      {supervisor ? (
        <AutoBuildSessionRow
          session={supervisor}
          label={t("timeline.autoBuild.supervisor", "Supervisor")}
          statusLabel={
            enabled && !supervisorActive && !failed ? t("timeline.autoBuild.sleeping", "sleeping") : undefined
          }
          onOpen={onOpenSession}
        />
      ) : (
        <Text textStyle="paragraph/S/regular">
          {enabled
            ? t("timeline.autoBuild.sleeping", "sleeping")
            : t("timeline.autoBuild.noSupervisor", "No supervisor session")}
        </Text>
      )}
      <Separator />
      <Stack gap="2xs">
        {sessions.map((session) => (
          <AutoBuildSessionRow
            key={session.id}
            session={session}
            label={t("timeline.autoBuild.ticketSession", "Ticket session")}
            onOpen={onOpenSession}
          />
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
