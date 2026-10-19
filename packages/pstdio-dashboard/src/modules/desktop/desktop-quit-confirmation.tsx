import { Button, Dialog, HStack, Portal, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useEffect, useRef, useState } from "react";
import type {
  DesktopActivity,
  DesktopActivityItem,
  DesktopLifecycleBridge,
  DesktopLifecycleState,
} from "@/lib/desktop-lifecycle-bridge";

interface DesktopQuitConfirmationDialogProps {
  /** The work that quitting would cancel. The dialog is open while this is set. */
  activity: DesktopActivity | null;
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
  const { activity, onKeepOpen, onQuit } = props;
  const keepOpenRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      role="alertdialog"
      open={activity !== null}
      scrollBehavior="inside"
      initialFocusEl={() => keepOpenRef.current}
      closeOnInteractOutside={false}
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
              <Button ref={keepOpenRef} size="sm" onClick={onKeepOpen}>
                Keep Prompt Studio open
              </Button>
              <Button size="sm" variant="destructive" onClick={onQuit}>
                Cancel work and quit
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

const confirmationActivity = (state: DesktopLifecycleState) =>
  state.kind === "confirming_active_work" && state.activity ? state.activity : null;

/** Shows the desktop quit warning over the workbench while Electron waits for a choice. */
export const DesktopQuitConfirmation = (props: { bridge: DesktopLifecycleBridge }) => {
  const { bridge } = props;
  const [activity, setActivity] = useState<DesktopActivity | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = bridge.onStartupState((state) => setActivity(confirmationActivity(state)));
    // A reloaded workbench must still show a confirmation that started before it loaded.
    void bridge.getStartupState().then((state) => {
      if (active) setActivity(confirmationActivity(state));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  return (
    <DesktopQuitConfirmationDialog
      activity={activity}
      onKeepOpen={() => void bridge.cancelQuit()}
      onQuit={() => void bridge.confirmQuit()}
    />
  );
};
