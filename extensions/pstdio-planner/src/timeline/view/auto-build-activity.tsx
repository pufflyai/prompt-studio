import { Button, HStack, Popover, Portal, Stack, Text, useRecipe, useSlotRecipe } from "@chakra-ui/react";
import { EmptyState, PopoverHeader, ScrollArea } from "@pstdio/ui";
import { psTheme } from "@pstdio/ui/theme";
import { Pause, Play, Square } from "lucide-react";
import { type ReactElement, useRef } from "react";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildHelp } from "./auto-build-help";
import { AutoBuildRequests } from "./auto-build-requests";
import { AutoBuildSessionRow } from "./auto-build-session-row";
import { AutoBuildSessions } from "./auto-build-sessions";
import { AutoBuildWarnings } from "./auto-build-warnings";

interface AutoBuildActivityProps
  extends Pick<
    AutoBuildButtonProps,
    | "enabled"
    | "paused"
    | "reviewRequests"
    | "requestErrors"
    | "onPause"
    | "onResume"
    | "completed"
    | "supervisor"
    | "sessions"
    | "running"
    | "capacity"
    | "error"
    | "actionError"
    | "stuck"
    | "matchingTicketCount"
    | "readyTicketCount"
    | "waitingTickets"
    | "starting"
    | "disabled"
    | "onOpenSession"
    | "t"
  > {
  open: boolean;
  failed: boolean;
  trigger: ReactElement;
  onOpenChange: (open: boolean) => void;
  onStop: () => void;
  onConfigure: () => void;
  onOpenRequests: () => void;
}

export function AutoBuildActivity(props: AutoBuildActivityProps) {
  const {
    open,
    trigger,
    disabled,
    enabled,
    paused,
    onOpenChange,
    onStop,
    onConfigure,
    onPause,
    onResume,
    reviewRequests = [],
    requestErrors = [],
    onOpenRequests,
    actionError,
    t,
    ...sessions
  } = props;
  const { supervisor, completed, failed, onOpenSession } = sessions;
  const supervisorActive = ["queued", "in_progress", "awaiting_input"].includes(supervisor?.status ?? "");
  const content = useRef<HTMLDivElement>(null);
  const danger = useRecipe({ recipe: psTheme.getRecipe("button") })({ variant: "destructive" });
  const styles = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "widget" });
  return (
    <Popover.Root
      lazyMount
      open={open}
      initialFocusEl={() => content.current}
      positioning={{ placement: "bottom-end" }}
      onOpenChange={({ open }) => onOpenChange(open)}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            ref={content}
            css={styles.content}
            width="popover-panel"
            display="flex"
            flexDirection="column"
            maxH="min({sizes.filter-picker-height}, var(--available-height))"
            aria-label="Auto Build activity"
          >
            <PopoverHeader
              icon={<Play />}
              title={
                <Popover.Title>
                  {t("timeline.autoBuild.start", "Auto Build")}
                  {paused ? ` · ${t("timeline.autoBuild.paused", "Paused")}` : ""}
                </Popover.Title>
              }
              actions={<AutoBuildHelp t={t} />}
            />
            <Popover.Body display="flex" flexDirection="column" minH="0" flex="1" p="0">
              <ScrollArea flex="1" minH="0" h="0" viewportProps={{ minH: "0", flex: "1" }}>
                <Stack gap="md" p="sm">
                  <AutoBuildWarnings {...sessions} enabled={enabled} actionError={actionError} t={t} />
                  {reviewRequests.some(({ state }) => state === "open") || requestErrors.length ? (
                    <AutoBuildRequests onOpen={onOpenRequests} t={t} />
                  ) : null}
                  <Stack gap="2xs">
                    <Text textStyle="label/2XS/medium" color="fg.muted">
                      {t("timeline.autoBuild.supervisor", "Supervisor")}
                    </Text>
                    {supervisor ? (
                      <AutoBuildSessionRow
                        session={supervisor}
                        sleeping={enabled && !completed && !supervisorActive && !failed}
                        onOpen={onOpenSession}
                      />
                    ) : (
                      <EmptyState size="sm" title={t("timeline.autoBuild.noSupervisor", "No supervisor")} />
                    )}
                  </Stack>
                  <AutoBuildSessions {...sessions} t={t} />
                </Stack>
              </ScrollArea>
            </Popover.Body>
            <Popover.Footer flexShrink="0" p="sm">
              <Stack w="full" alignItems="end">
                {enabled ? (
                  <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onPause?.()}>
                    <Pause />
                    {t("timeline.autoBuild.pause", "Pause")}
                  </Button>
                ) : null}
                {!enabled && paused ? (
                  <HStack gap="xs">
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onResume?.()}>
                      <Play />
                      {t("timeline.autoBuild.resume", "Resume")}
                    </Button>
                    <Button size="sm" css={danger} disabled={disabled} onClick={onStop}>
                      <Square />
                      {t("timeline.autoBuild.stop", "Stop Auto Build")}
                    </Button>
                  </HStack>
                ) : null}
                {!enabled && !paused ? (
                  <Button size="sm" variant="outline" disabled={disabled} onClick={onConfigure}>
                    <Play />
                    {t("timeline.autoBuild.start", "Auto Build")}
                  </Button>
                ) : null}
              </Stack>
            </Popover.Footer>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
