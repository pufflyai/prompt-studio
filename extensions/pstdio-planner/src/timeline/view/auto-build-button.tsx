import { Button, Popover, Portal, Separator, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { AlertMessage, installPrismGlobal } from "@pstdio/ui";
import { psTheme } from "@pstdio/ui/theme";
import { Pause, Play } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { AutoBuildFormProps } from "./auto-build-form";
import { AutoBuildIndicator, resolveAutoBuildIndicatorStatus } from "./auto-build-indicator";
import { type AutoBuildSession, AutoBuildSessionRow } from "./auto-build-session-row";

// The prompt editor loads only when someone opens the configuration.
const AutoBuildForm = lazy(async () => {
  await installPrismGlobal();
  return import("./auto-build-form").then((module) => ({ default: module.AutoBuildForm }));
});

interface AutoBuildButtonProps {
  enabled: boolean;
  completed?: boolean;
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
    completed,
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
  const failed = (!completed && supervisor?.status === "failed") || Boolean(error);
  const inspectable = enabled || failed;
  const changeOpen = (open: boolean) => {
    if (disabled) return;
    if (!open) {
      setContent(null);
      return;
    }
    setContent(inspectable ? "sessions" : "configuration");
  };
  const status = resolveAutoBuildIndicatorStatus({
    enabled,
    completed,
    failed,
    stuck,
    supervisorStatus: supervisor?.status,
    running,
  });
  const activity = status?.replaceAll("_", " ") ?? "off";
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
          size="xs"
          variant="outline"
          disabled={disabled}
        >
          {status ? <AutoBuildIndicator status={status} label={`Auto Build ${activity}`} /> : <Play />}
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
                    completed={completed}
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
              <Suspense fallback={null}>
                <AutoBuildForm {...configuration} onClose={() => setContent(null)} t={t} />
              </Suspense>
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
function AutoBuildSessions(props: AutoBuildSessionsProps) {
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
