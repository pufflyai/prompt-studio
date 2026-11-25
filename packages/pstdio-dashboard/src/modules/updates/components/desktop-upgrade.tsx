import { Button, Dialog, Portal } from "@chakra-ui/react";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import { useRef } from "react";

interface UpgradeConfirmationProps {
  version: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestart: () => void;
}

export const DesktopUpgradeButton = ({ onClick }: { onClick: () => void }) => (
  <Button size="2xs" variant="primary" onClick={onClick}>
    <WorkbenchIcon name="arrow-up" size={14} />
    Upgrade
  </Button>
);

export const DesktopUpgradeDialog = (props: UpgradeConfirmationProps) => {
  const { version, open, onOpenChange, onRestart } = props;
  const laterRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      role="alertdialog"
      open={open}
      initialFocusEl={() => laterRef.current}
      closeOnInteractOutside={false}
      onOpenChange={({ open }) => onOpenChange(open)}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            onKeyDown={(event) => {
              if (event.key.toLowerCase() !== "y" || event.altKey || event.ctrlKey || event.metaKey || event.repeat)
                return;
              event.preventDefault();
              event.stopPropagation();
              onRestart();
            }}
          >
            <Dialog.Header>
              <Dialog.Title>Restart app to install upgrade?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>Prompt Studio {version} is ready to install.</Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Button ref={laterRef} size="sm" onClick={() => onOpenChange(false)}>
                Later
              </Button>
              <Button size="sm" variant="primary" aria-keyshortcuts="Y" onClick={onRestart}>
                Restart
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
