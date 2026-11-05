import { Button, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import { useEffect, useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import { settingsLeaveGuard } from "./settings-leave-guard";

export const SettingsLeaveWarning = (props: { workbench: WorkbenchCore }) => {
  const guard = settingsLeaveGuard(props.workbench);
  const warning = useSyncExternalStore(guard.subscribe, guard.getSnapshot);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (guard.isDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [guard]);
  return (
    <Dialog.Root
      open={warning !== null}
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
              <Text>You have unsaved changes to “{warning?.title}”. Save before leaving?</Text>
              {warning?.error ? (
                <Text role="alert" color="fg.error">
                  {warning.error}
                </Text>
              ) : null}
            </Dialog.Body>
            <Dialog.Footer flexWrap="wrap">
              <Button variant="ghost" disabled={warning?.saving} onClick={guard.stay}>
                Stay
              </Button>
              <Button variant="destructive" disabled={warning?.saving} onClick={() => void guard.leave(false)}>
                Discard changes
              </Button>
              <Button variant="primary" loading={warning?.saving} onClick={() => void guard.leave(true)}>
                Save and leave
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
