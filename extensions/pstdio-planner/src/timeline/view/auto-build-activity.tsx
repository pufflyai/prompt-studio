import { Button, CloseButton, HStack, Popover, Portal, Separator, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { psTheme } from "@pstdio/ui/theme";
import { Pause, Play } from "lucide-react";
import { type RefObject, useRef } from "react";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildHelp } from "./auto-build-help";
import { AutoBuildRequests } from "./auto-build-requests";
import { AutoBuildSessions } from "./auto-build-sessions";

interface AutoBuildActivityProps
  extends Pick<
    AutoBuildButtonProps,
    | "enabled"
    | "paused"
    | "reviewRequests"
    | "requestErrors"
    | "onOpenRequest"
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
  anchor: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onConfigure: () => void;
}

export function AutoBuildActivity(props: AutoBuildActivityProps) {
  const {
    open,
    anchor,
    disabled,
    enabled,
    paused,
    onClose,
    onConfigure,
    onPause,
    onResume,
    reviewRequests,
    requestErrors,
    onOpenRequest,
    actionError,
    t,
    ...sessions
  } = props;
  const content = useRef<HTMLDivElement>(null);
  const styles = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "panel" });
  return (
    <Popover.Root
      lazyMount
      unmountOnExit
      open={open}
      initialFocusEl={() => content.current}
      positioning={{ placement: "bottom-end", getAnchorElement: () => anchor.current }}
      onOpenChange={({ open }) => !open && onClose()}
    >
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            ref={content}
            css={styles.content}
            display="flex"
            flexDirection="column"
            maxH="min({sizes.filter-picker-height}, var(--available-height))"
            aria-label="Auto Build activity"
          >
            <Popover.Header flexShrink="0">
              <HStack gap="xs">
                <Popover.Title>
                  {t("timeline.autoBuild.start", "Auto Build")}
                  {paused ? ` · ${t("timeline.autoBuild.paused", "Paused")}` : ""}
                </Popover.Title>
                <AutoBuildHelp t={t} />
                <CloseButton size="sm" disabled={disabled} onClick={onClose} marginLeft="auto" />
              </HStack>
            </Popover.Header>
            <Popover.Body display="flex" flexDirection="column" minH="0" flex="1">
              <ScrollArea flex="1" minH="0" h="0" viewportProps={{ minH: "0", flex: "1" }}>
                <Stack gap="md">
                  <AutoBuildRequests
                    reviewRequests={reviewRequests}
                    requestErrors={requestErrors}
                    onOpenRequest={onOpenRequest}
                    t={t}
                  />
                  <AutoBuildSessions {...sessions} enabled={enabled} t={t} />
                </Stack>
              </ScrollArea>
            </Popover.Body>
            <Popover.Footer flexShrink="0">
              <Stack w="full" alignItems="end">
                <Separator w="full" />
                {actionError ? (
                  <Text role="alert" color="fg.error">
                    {actionError}
                  </Text>
                ) : null}
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
