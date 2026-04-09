import { Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";

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
  const { t } = useTranslation("tickets");

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
            <Text textStyle="heading/M">{t("createWorkspaceModal.title")}</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" disabled={isSubmitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Text textStyle="paragraph/S/regular" color="foreground.secondary">
                {attemptCount === 0 ? t("createWorkspaceModal.firstAttempt") : t("createWorkspaceModal.nextAttempt")}
              </Text>

              <HStack justify="space-between" align="center" wrap="wrap">
                <AgentBrowserContainer isDisabled={isSubmitting} />
                <RepoBrowserContainer isDisabled={isSubmitting} />
              </HStack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                {t("createWorkspaceModal.cancel")}
              </Button>
              <Button size="sm" variant="primary" onClick={handleConfirm} loading={isSubmitting} disabled={isDisabled}>
                {t("createWorkspaceModal.runAttempt")}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
