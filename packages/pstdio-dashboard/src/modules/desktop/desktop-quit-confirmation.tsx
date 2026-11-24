import { Button, Dialog, HStack, Portal, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useRef, useSyncExternalStore } from "react";
import type { DesktopActivity, DesktopActivityItem, DesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { type DesktopQuitChoice, getDesktopQuitDecision } from "./desktop-quit-decision";

interface DesktopQuitConfirmationDialogProps {
  /** The work that quitting would cancel. The dialog is open while this is set. */
  activity: DesktopActivity | null;
  pending?: DesktopQuitChoice;
  error?: string;
  onCheck?: () => void;
  onKeepOpen: () => void;
  onQuit: () => void;
}

const activityGroups = (activity: DesktopActivity) => [
  { label: "Agent session", icon: "message-square", items: activity.sessions },
  { label: "Terminal", icon: "terminal", items: activity.terminals },
  { label: "Automation", icon: "workflow", items: activity.jobs },
];

const ActiveWorkCard = (props: { item: DesktopActivityItem; kind: string; icon: string }) => {
  const { item, kind, icon } = props;
  return (
    <SimpleCard as="li">
      <SimpleCardBody>
        <HStack gap="sm">
          <WorkbenchIcon name={icon} size={16} color="fg.muted" />
          <Stack gap="none" minW="0" flex="1">
            <Text textStyle="paragraph/S/medium" truncate title={item.label}>
              {item.label}
            </Text>
            <Text textStyle="label/S/regular" color="fg.muted" truncate title={item.description}>
              {item.description ? `${kind} · ${item.description}` : kind}
            </Text>
          </Stack>
        </HStack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

export const DesktopQuitConfirmationDialog = (props: DesktopQuitConfirmationDialogProps) => {
  const { activity, pending, error, onCheck, onKeepOpen, onQuit } = props;
  const keepOpenRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      role="alertdialog"
      open={activity !== null}
      scrollBehavior="inside"
      initialFocusEl={() => keepOpenRef.current}
      closeOnInteractOutside={false}
      closeOnEscape={!pending}
      onOpenChange={(details) => {
        if (!details.open) onKeepOpen();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Active work is still running</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="sm">
                {error && (
                  <AlertMessage
                    compact
                    status="error"
                    title="Desktop quit"
                    endElement={
                      onCheck && (
                        <Button size="sm" onClick={onCheck}>
                          Check status
                        </Button>
                      )
                    }
                  >
                    {error}
                  </AlertMessage>
                )}
                <Dialog.Description color="fg.muted" textStyle="paragraph/M/regular">
                  Quitting will stop these activities.
                </Dialog.Description>
                {activity && (
                  <Stack as="ul" gap="xs" listStyle="none" padding="0" margin="0">
                    {activityGroups(activity).flatMap((group) =>
                      group.items.map((item) => (
                        <ActiveWorkCard
                          key={`${group.label}:${item.id}`}
                          item={item}
                          kind={group.label}
                          icon={group.icon}
                        />
                      )),
                    )}
                  </Stack>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer flexWrap="wrap">
              <Button
                ref={keepOpenRef}
                size="sm"
                disabled={pending === "quit"}
                loading={pending === "keep-open"}
                loadingText="Keeping Prompt Studio open…"
                onClick={onKeepOpen}
              >
                Keep Prompt Studio open
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending === "keep-open"}
                loading={pending === "quit"}
                loadingText="Quitting…"
                onClick={onQuit}
              >
                Cancel work and quit
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

/** Shows the desktop quit warning over the workbench while Electron waits for a choice. */
export const DesktopQuitConfirmation = (props: { bridge: DesktopLifecycleBridge }) => {
  const decision = getDesktopQuitDecision(props.bridge);
  const { activity, pending, error, canCheck } = useSyncExternalStore(decision.subscribe, decision.read, decision.read);
  return (
    <DesktopQuitConfirmationDialog
      activity={activity}
      pending={pending}
      error={error}
      onCheck={canCheck ? () => void decision.check() : undefined}
      onKeepOpen={() => void decision.choose("keep-open")}
      onQuit={() => void decision.choose("quit")}
    />
  );
};
