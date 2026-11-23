import { Button, Dialog, Portal } from "@chakra-ui/react";

export default { title: "Proposals/PS-289/Pending desktop quit", fullscreen: true };

export const PendingDesktopQuit = () => (
  <Dialog.Root open role="alertdialog" closeOnEscape={false}>
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Active work is still running</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Dialog.Description>Quitting will stop these activities.</Dialog.Description>
          </Dialog.Body>
          <Dialog.Footer flexWrap="wrap">
            <Button size="sm" disabled>
              Keep Prompt Studio open
            </Button>
            <Button size="sm" variant="destructive" loading loadingText="Quitting…">
              Cancel work and quit
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);
