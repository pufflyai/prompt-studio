import { CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";

interface Props {
  source: { path: string; content: string };
  onClose: () => void;
}
export function BookSource(props: Props) {
  const { source, onClose } = props;
  return (
    <Dialog.Root
      open
      size="xl"
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{source.path}</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close source" />
            </Dialog.CloseTrigger>
            <ScrollArea maxH="70vh">
              <Dialog.Body>
                <Text as="pre" whiteSpace="pre-wrap" textStyle="paragraph/XS/regular">
                  {source.content}
                </Text>
              </Dialog.Body>
            </ScrollArea>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
