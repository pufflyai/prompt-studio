import { Button, Icon, Popover, Portal, Separator, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { psTheme } from "@pstdio/ui/theme";
import { CircleDot, Pause, Play } from "lucide-react";
import { useState } from "react";
import { AutoBuildForm, type AutoBuildFormProps } from "./auto-build-form";
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
  configuration?: Omit<AutoBuildFormProps, "onClose" | "t">;
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
    configuration,
    onTurnOff,
    onOpenSession,
    t,
  } = props;
  const [content, setContent] = useState<"configuration" | "sessions" | null>(null);
  const panel = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "panel" });
  const failed = supervisor?.status === "failed" || Boolean(error);
  const inspectable = enabled || failed;
  const changeOpen = (open: boolean) => {
    if (disabled) return;
    if (!open) {
      setContent(null);
      return;
    }
    setContent(inspectable ? "sessions" : "configuration");
  };
  let activity = "waiting";
  let color = stuck ? "fg.warning" : "fg.muted";
  if (failed) {
    activity = "error";
    color = "fg.error";
  } else if (running > 0) {
    activity = "running";
  }
  const stop = async () => {
    if (await onTurnOff()) setContent(null);
  };
  return (
    <Popover.Root
      lazyMount
      unmountOnExit
      open={content !== null}
      onOpenChange={({ open }) => changeOpen(open)}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger asChild>
        <Button
          aria-label={t("timeline.autoBuild.start", "Auto Build")}
          aria-description={enabled || failed ? `Auto Build ${activity}` : undefined}
          size="sm"
          variant="outline"
          disabled={disabled}
        >
          {enabled || failed ? (
            <Icon
              as={CircleDot}
              role="img"
              aria-label={`Auto Build ${activity}`}
              data-activity={activity}
              boxSize="icon-sm"
              color={color}
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
            aria-label="Auto Build"
            css={panel.content}
            maxW="calc(100vw - 2 * var(--chakra-spacing-xs))"
          >
            {content === "sessions" ? (
              <>
                <Popover.Header
                  css={panel.header}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap="xs"
                >
                  <Popover.Title css={panel.title} whiteSpace="nowrap">
                    {t("timeline.autoBuild.start", "Auto Build")}
                  </Popover.Title>
                  {enabled ? (
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => void stop()}>
                      <Pause />
                      {t("timeline.autoBuild.stop", "Stop")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        setContent("configuration");
                      }}
                    >
                      <Play />
                      {t("timeline.autoBuild.start", "Auto Build")}
                    </Button>
                  )}
                </Popover.Header>
                <Separator />
                <Popover.Body css={panel.body}>
                  <AutoBuildSessions
                    enabled={enabled}
                    supervisor={supervisor}
                    sessions={sessions}
                    failed={failed}
                    error={error}
                    stuck={stuck}
                    running={running}
                    capacity={capacity}
                    onOpenSession={onOpenSession}
                    t={t}
                  />
                </Popover.Body>
              </>
            ) : null}
            {content === "configuration" && configuration ? (
              <AutoBuildForm {...configuration} onClose={() => setContent(null)} t={t} />
            ) : null}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

interface AutoBuildSessionsProps
  extends Pick<
    AutoBuildButtonProps,
    "enabled" | "supervisor" | "sessions" | "running" | "capacity" | "error" | "stuck" | "onOpenSession" | "t"
  > {
  failed: boolean;
}
function AutoBuildSessions(props: AutoBuildSessionsProps) {
  const { enabled, supervisor, sessions, running, capacity, failed, error, stuck, onOpenSession, t } = props;
  const supervisorActive = ["queued", "in_progress", "awaiting_input"].includes(supervisor?.status ?? "");
  return (
    <Stack gap="md">
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
            label={t("timeline.autoBuild.supervisor", "Supervisor")}
            statusLabel={
              enabled && !supervisorActive && !failed ? t("timeline.autoBuild.sleeping", "Sleeping") : undefined
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
      </Stack>
      <Text textStyle="label/XS" color="fg.muted">
        {t("timeline.autoBuild.running", "Running")} · {running} {t("timeline.autoBuild.capacity", "of")} {capacity}{" "}
        {t("timeline.autoBuild.agents", "agents")}
      </Text>
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
