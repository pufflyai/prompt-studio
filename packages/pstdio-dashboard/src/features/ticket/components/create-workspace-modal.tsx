import { Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";

interface CreateWorkspaceModalProps {
  open: boolean;
  attemptCount: number;
  showAgentSelector?: boolean;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  confirmLabel?: string;
  description?: string;
  onClose: () => void;
  onConfirm: () => Promise<boolean> | boolean;
}

export const runCreateWorkspaceModalConfirm = async (input: {
  isSubmitting: boolean;
  isDisabled: boolean;
  onConfirm: () => Promise<boolean> | boolean;
  onClose: () => void;
}) => {
  if (input.isSubmitting || input.isDisabled) return false;

  const started = await input.onConfirm();
  if (started) {
    input.onClose();
  }

  return started;
};

export const CreateWorkspaceModal = (props: CreateWorkspaceModalProps) => {
  const {
    open,
    attemptCount,
    showAgentSelector = true,
    isSubmitting = false,
    isDisabled = false,
    confirmLabel,
    description,
    onClose,
    onConfirm,
  } = props;
  const { t } = useTranslation("tickets");

  const handleConfirm = async () => {
    await runCreateWorkspaceModalConfirm({ isSubmitting, isDisabled, onConfirm, onClose });
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
                {description ??
                  (attemptCount === 0 ? t("createWorkspaceModal.firstAttempt") : t("createWorkspaceModal.nextAttempt"))}
              </Text>

              <HStack justify="space-between" align="center" wrap="wrap">
                {showAgentSelector ? <AgentBrowserContainer isDisabled={isSubmitting} /> : null}
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
                {confirmLabel ?? t("createWorkspaceModal.runAttempt")}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
