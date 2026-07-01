import { Button, Dialog, Icon, IconButton, Portal, Stack, Text } from "@chakra-ui/react";
import { Download, X } from "lucide-react";
import type { ReactNode } from "react";

interface MermaidFullscreenProps {
  children: ReactNode;
  canDownload: boolean;
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export const MermaidFullscreen = (props: MermaidFullscreenProps) => {
  const { children, canDownload, open, onClose, onDownload } = props;

  return (
    <Dialog.Root lazyMount unmountOnExit open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner padding={{ base: "sm", md: "lg" }}>
          <Dialog.Content
            width="min(72rem, calc(100vw - 2rem))"
            height="min(48rem, calc(100dvh - 2rem))"
            maxW="none"
            borderRadius="xs"
            overflow="hidden"
            display="flex"
            flexDirection="column"
          >
            <Dialog.Header
              data-testid="mermaid-fullscreen-header"
              p="sm"
              borderBottomWidth="1px"
              borderColor="border.subtle"
            >
              <Stack direction="row" align="center" justify="space-between" width="100%" gap="sm">
                <Dialog.Title asChild>
                  <Text textStyle="heading/S">Mermaid diagram</Text>
                </Dialog.Title>
                <Stack direction="row" align="center" gap="xs">
                  <Button size="sm" variant="subtle" onClick={onDownload} disabled={!canDownload}>
                    <Icon as={Download} boxSize="16px" />
                    Download as PNG
                  </Button>
                  <IconButton aria-label="Close" size="sm" variant="ghost" onClick={onClose}>
                    <Icon as={X} boxSize="16px" />
                  </IconButton>
                </Stack>
              </Stack>
            </Dialog.Header>
            <Dialog.Body data-testid="mermaid-fullscreen-body" p="0" flex="1" minH="0">
              {children}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
