import { Button, CloseButton, Dialog, Stack, Text, Textarea } from "@chakra-ui/react";
import { useEffect, useState } from "react";

interface CreateTicketDialogProps {
  open: boolean;
  status: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: { content: string; status: string | null }) => Promise<void>;
}

export const CreateTicketDialog = (props: CreateTicketDialogProps) => {
  const { open, status, submitting, onClose, onSubmit } = props;
  const [content, setContent] = useState("");
  const trimmedContent = content.trim();

  useEffect(() => {
    if (!open) setContent("");
  }, [open]);

  const handleSubmit = async () => {
    if (!trimmedContent) return;
    await onSubmit({ content: trimmedContent, status });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/S">Create ticket</Text>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="sm">
              {status ? (
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Status: {status}
                </Text>
              ) : null}
              <Textarea
                value={content}
                minH="180px"
                placeholder="Ticket content"
                onChange={(event) => setContent(event.target.value)}
              />
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={submitting} disabled={!trimmedContent} onClick={() => void handleSubmit()}>
              Create
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
