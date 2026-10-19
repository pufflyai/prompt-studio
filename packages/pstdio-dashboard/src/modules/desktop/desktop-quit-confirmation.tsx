import { Box, Button, Dialog, Portal, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { DesktopActivity, DesktopLifecycleBridge, DesktopLifecycleState } from "@/lib/desktop-lifecycle-bridge";

interface DesktopQuitConfirmationDialogProps {
  /** The work that quitting would cancel. The dialog is open while this is set. */
  activity: DesktopActivity | null;
  onKeepOpen: () => void;
  onQuit: () => void;
}

const activityGroups = (activity: DesktopActivity) => [
  { label: "Agent sessions", items: activity.sessions },
  { label: "Terminals", items: activity.terminals },
  { label: "Jobs", items: activity.jobs },
];

export const DesktopQuitConfirmationDialog = (props: DesktopQuitConfirmationDialogProps) => {
  const { activity, onKeepOpen, onQuit } = props;
  const keepOpenRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      role="alertdialog"
      open={activity !== null}
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
                  Canceling this work will stop the items below. This cannot be undone.
                </Dialog.Description>
                {activity &&
                  activityGroups(activity).map((group) => {
                    if (group.items.length === 0) return null;
                    return (
                      <Box key={group.label} bg="bg.muted" borderRadius="xs" px="sm" py="xs">
                        <Text textStyle="label/S/medium" color="fg.muted">
                          {group.label}
                        </Text>
                        <Stack as="ul" gap="2xs" listStyle="none" padding="0" margin="0" mt="2xs">
                          {group.items.map((item) => (
                            <Text as="li" key={item.id} textStyle="paragraph/M/regular">
                              {item.label}
                            </Text>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
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
