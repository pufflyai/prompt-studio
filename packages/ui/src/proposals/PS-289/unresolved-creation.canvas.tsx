import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { AlertMessage } from "../../components/primitives/alert";
import { ScopedDialog as Dialog } from "../../utils/scoped-overlays";

export default { title: "Proposals/PS-289 Unresolved creation", fullscreen: true };

export const InspectOrRecover = () => {
  const [open, setOpen] = useState(true);
  const [retained, setRetained] = useState(true);
  return (
    <Stack p="md">
      <Text>Tickets</Text>
      <Text>Review project setup</Text>
      {retained ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          Open submitted draft
        </Button>
      ) : null}
      <Dialog.Root open={open} onOpenChange={({ open }) => setOpen(open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>New ticket</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md">
                <Text>Review project setup</Text>
                <AlertMessage status="warning" title="Creation could not be confirmed." compact>
                  Opening the resource list does not confirm this submission.
                </AlertMessage>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack wrap="wrap">
                <Button size="sm" onClick={() => setOpen(false)}>
                  Inspect resources
                </Button>
                <Button size="sm" onClick={() => void navigator.clipboard.writeText("Review project setup")}>
                  Copy draft
                </Button>
                <Button size="sm" onClick={() => setOpen(false)}>
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setRetained(false);
                    setOpen(false);
                  }}
                >
                  Discard draft
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
