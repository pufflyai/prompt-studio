import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useEffect } from "react";
import type { ReviewRequestView } from "../../src/data/review-request-types";
import { NeedsAttentionPreview } from "./needs-attention-preview";

interface RequestModalProps {
  title: string;
  requests: ReviewRequestView[];
  open: boolean;
  failSave?: boolean;
  answered?: string[];
  onAnswered?: (id: string) => void;
  onClose: () => void;
  finalFocusEl: () => HTMLElement | null;
}

export function RequestModal(props: RequestModalProps) {
  const { title, requests, open, onClose, finalFocusEl, answered, onAnswered, failSave } = props;
  const empty = requests.every(({ id }) => answered?.includes(id));
  useEffect(() => {
    if (open && empty) onClose();
  }, [open, empty, onClose]);
  return (
    <Dialog.Root
      unmountOnExit={false}
      open={open && !empty}
      onOpenChange={({ open }) => !open && onClose()}
      size="md"
      scrollBehavior="inside"
      finalFocusEl={finalFocusEl}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea>
                <NeedsAttentionPreview
                  requests={requests}
                  answered={answered}
                  onAnswered={onAnswered}
                  failSave={failSave}
                />
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
