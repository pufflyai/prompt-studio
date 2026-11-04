import { Button, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import { createContext, type ReactNode, useContext, useState } from "react";
import { createSettingsLeaveGuard } from "./settings-leave-guard";

const LeaveGuardContext = createContext<ReturnType<typeof createSettingsLeaveGuard> | null>(null);
export const useSettingsLeaveGuard = () => useContext(LeaveGuardContext)!;

export const SettingsLeaveWarning = (props: { children: ReactNode }) => {
  const [title, setTitle] = useState<string | null>(null);
  const [guard] = useState(() => createSettingsLeaveGuard(setTitle));
  return (
    <LeaveGuardContext value={guard}>
      {props.children}
      <Dialog.Root
        open={title !== null}
        size="sm"
        closeOnInteractOutside={false}
        onOpenChange={(details) => {
          if (!details.open) guard.stay();
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Unsaved changes</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>You have unsaved changes to “{title}”. Save before leaving?</Text>
              </Dialog.Body>
              <Dialog.Footer flexWrap="wrap">
                <Button variant="ghost" onClick={guard.stay}>
                  Stay
                </Button>
                <Button variant="destructive" onClick={() => guard.leave(false)}>
                  Discard changes
                </Button>
                <Button variant="primary" onClick={() => guard.leave(true)}>
                  Save and leave
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </LeaveGuardContext>
  );
};
