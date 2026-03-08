import { Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { ContentPlaceholder, ContentPlaceholderLabel } from "@pstdio/ui";
import { WorkspaceAgentBrowserContainer } from "@/features/agents/components/agent-browser.container";

// TODO: Build WorkspaceRepoMenuContainer — stubbed as placeholder for now
const WorkspaceRepoMenuPlaceholder = () => (
  <ContentPlaceholder>
    <ContentPlaceholderLabel>Repo selector</ContentPlaceholderLabel>
  </ContentPlaceholder>
);

interface CreateWorkspaceModalProps {
  open: boolean;
  attemptCount: number;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean> | boolean;
}

export const CreateWorkspaceModal = (props: CreateWorkspaceModalProps) => {
  const { open, attemptCount, isSubmitting = false, isDisabled = false, onClose, onConfirm } = props;

  const handleConfirm = async () => {
    if (isSubmitting || isDisabled) return;

    const started = await onConfirm();
    if (started) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">Create Workspace</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" disabled={isSubmitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Text textStyle="paragraph/S/regular" color="foreground.secondary">
                {attemptCount === 0
                  ? "Configure the first workspace attempt for this ticket."
                  : "Configure the next workspace attempt from the latest state."}
              </Text>

              <HStack justify="space-between" align="center" wrap="wrap">
                <WorkspaceAgentBrowserContainer isDisabled={isSubmitting} />
                <WorkspaceRepoMenuPlaceholder />
              </HStack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="sm" variant="solid" onClick={handleConfirm} loading={isSubmitting} disabled={isDisabled}>
                Run Attempt
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
