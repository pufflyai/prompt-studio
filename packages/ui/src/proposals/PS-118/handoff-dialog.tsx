import { Badge, Button, CloseButton, HStack, Stack, Text } from "@chakra-ui/react";
import { FileText } from "lucide-react";
import { MarkdownEditor } from "@/components/rich-text/markdown-editor/markdown-editor";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import type { ReviewPrototype } from "./use-review-prototype";

export function HandoffDialog({ review }: { review: ReviewPrototype }) {
  return (
    <Dialog.Root size="md" open={review.confirmation} onOpenChange={({ open }) => review.setConfirmation(open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Start an agent session?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md">
                <Badge variant="chip" alignSelf="start">
                  @{review.draft?.target?.handle}
                </Badge>
                <Text textStyle="paragraph/S/regular">
                  The agent receives the current ticket and every comment in this thread. It can use tools and may incur
                  usage costs.
                </Text>
                <Stack gap="xs">
                  <HStack>
                    <FileText />
                    <Text>PS-118 · Ticket body</Text>
                  </HStack>
                  <HStack>
                    <FileText />
                    <Text>Selected quote and complete thread</Text>
                  </HStack>
                </Stack>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  “{review.draft?.quote}”
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => review.setConfirmation(false)}>
                Back to comment
              </Button>
              <Button variant="primary" onClick={review.saveDraft}>
                Start session
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export function SessionPreview({ review }: { review: ReviewPrototype }) {
  return (
    <Dialog.Root
      size="xl"
      open={Boolean(review.session)}
      onOpenChange={({ open }) => {
        if (!open) review.setSession(undefined);
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Stack gap="xs">
                <Dialog.Title>Review session · PS-118</Dialog.Title>
                <Badge variant="chip" alignSelf="start">
                  Prototype · simulated session
                </Badge>
              </Stack>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="sm">
                <Text textStyle="label/M/medium">Attached context</Text>
                <MarkdownEditor
                  key={review.session?.id}
                  defaultState={`${review.session?.thread ?? ""}\n\n---\n\n${review.session?.ticket ?? ""}`}
                  scrollable={false}
                  padding="0"
                />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => review.setSession(undefined)}>Back to ticket</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
