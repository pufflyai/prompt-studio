import { Box, Button, Popover, Portal, Stack, Text } from "@chakra-ui/react";
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
    disabled,
    onConfigure,
    onTurnOff,
    onOpenSession,
    t,
  } = props;
  const [open, setOpen] = useState(false);
  const failed = supervisor?.status === "failed" || Boolean(error);
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
      open={open && enabled}
      onOpenChange={({ open }) => setOpen(enabled && open)}
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
            if (!enabled) onConfigure();
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
              <Button size="2xs" variant="outline" disabled={disabled} onClick={() => void stop()}>
                <Pause />
                {t("timeline.autoBuild.stop", "Stop Auto Build")}
              </Button>
            </Popover.Header>
            <Popover.Body>
              <Stack gap="2xs">
                {supervisor ? (
                  <AutoBuildSessionRow
                    session={supervisor}
                    label={t("timeline.autoBuild.supervisor", "Supervisor")}
                    onOpen={onOpenSession}
                  />
                ) : (
                  <Text textStyle="paragraph/S/regular">
                    {t("timeline.autoBuild.waiting", "Waiting for valid tickets and capacity")}
                  </Text>
                )}
                {sessions.map((session) => (
                  <AutoBuildSessionRow
                    key={session.id}
                    session={session}
                    label={t("timeline.autoBuild.ticketSession", "Ticket session")}
                    onOpen={onOpenSession}
                  />
                ))}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
