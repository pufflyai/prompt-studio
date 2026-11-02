import { Button, CloseButton, Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";

interface DeleteConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
  headline?: string;
  notificationText?: string;
  buttonText?: string;
  /** Extra controls rendered below the message, e.g. an opt-in checkbox. */
  children?: ReactNode;
}

export type { DeleteConfirmationModalProps };

export const DeleteConfirmationModal = (props: DeleteConfirmationModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { headline, buttonText, notificationText, onDelete, open, onClose, children } = props;

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await onDelete();
      onClose();
    } catch {
      // Errors surface through parent state.
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    // Destructive confirmations dismiss only through their explicit controls —
    // outside interactions must never cancel them, and when nested inside another
    // overlay (e.g. the settings dialog) a portal keeps the layers cooperating.
    <Dialog.Root
      size="sm"
      open={open}
      onOpenChange={(details) => {
        if (!details.open && !isDeleting) onClose();
      }}
      closeOnInteractOutside={false}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text textStyle="heading/M">{headline}</Text>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={isDeleting} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3">
                {notificationText ? <Text>{notificationText}</Text> : null}
                {children}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Stack direction="row" gap="1">
                <Button onClick={onClose} disabled={isDeleting}>
                  Close
                </Button>
                <Button loading={isDeleting} variant="destructive" onClick={handleDelete}>
                  {buttonText}
                </Button>
              </Stack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
