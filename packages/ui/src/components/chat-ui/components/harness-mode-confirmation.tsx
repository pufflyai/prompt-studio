import { Button, CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { AlertMessage } from "@/components/primitives/alert";
import { RichMessage } from "@/components/rich-text";
import type { HarnessControlsProps } from "./harness-controls";

interface HarnessModeConfirmationProps {
  mode: HarnessControlsProps["modes"][number];
  open: boolean;
  pending?: boolean;
  unavailable?: boolean;
  error?: HarnessControlsProps["error"];
  onClose: () => void;
  onApprove: () => Promise<void>;
}

export const HarnessModeConfirmation = (props: HarnessModeConfirmationProps) => {
  const { mode, open, pending, unavailable, error, onClose, onApprove } = props;
  const confirmation = mode.confirmation;
  const action = mode.actions.find((action) => action.id === confirmation?.actionId);
  if (!confirmation || !action) return null;
  return (
    <Dialog.Root
      open={open}
      size="sm"
      scrollBehavior="inside"
      closeOnInteractOutside={false}
      onOpenChange={(details) => {
        if (!details.open && !pending) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{confirmation.title}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={pending} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <RichMessage defaultState={mode.description} fullWidth />
              {error ? (
                <AlertMessage status="error" title="Action failed" onClose={error.onClose}>
                  {error.message}
                </AlertMessage>
              ) : null}
            </Dialog.Body>
            <Dialog.Footer>
              <Button size="sm" variant="ghost" disabled={pending} onClick={onClose}>
                {confirmation.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={pending}
                disabled={pending || unavailable}
                onClick={() => void onApprove()}
              >
                {action.label}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
