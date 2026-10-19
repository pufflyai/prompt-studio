import { Button, CloseButton, HStack, Popover, Portal, Stack, useSlotRecipe } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { psTheme } from "@pstdio/ui/theme";
import { Pause, Play } from "lucide-react";
import { type RefObject, useRef } from "react";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildHelp } from "./auto-build-help";
import { AutoBuildSessions } from "./auto-build-sessions";

interface AutoBuildActivityProps
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
    | "matchingTicketCount"
    | "starting"
    | "disabled"
    | "onOpenSession"
    | "t"
  > {
  open: boolean;
  failed: boolean;
  anchor: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onStop: () => void;
  onConfigure: () => void;
}

export function AutoBuildActivity(props: AutoBuildActivityProps) {
  const { open, anchor, disabled, enabled, onClose, onStop, onConfigure, t, ...sessions } = props;
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
          <Popover.Content ref={content} css={styles.content} aria-label="Auto Build activity">
            <Popover.Header>
              <HStack gap="xs">
                <Popover.Title>{t("timeline.autoBuild.start", "Auto Build")}</Popover.Title>
                <AutoBuildHelp t={t} />
                <CloseButton size="sm" disabled={disabled} onClick={onClose} marginLeft="auto" />
              </HStack>
            </Popover.Header>
            <Popover.Body>
              <ScrollArea maxH="filter-picker-height">
                <AutoBuildSessions {...sessions} enabled={enabled} t={t} />
              </ScrollArea>
            </Popover.Body>
            <Popover.Footer>
              <Stack align="end">
                {enabled ? (
                  <Button size="sm" variant="outline" disabled={disabled} onClick={onStop}>
                    <Pause />
                    {t("timeline.autoBuild.stop", "Stop")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={disabled} onClick={onConfigure}>
                    <Play />
                    {t("timeline.autoBuild.start", "Auto Build")}
                  </Button>
                )}
              </Stack>
            </Popover.Footer>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
