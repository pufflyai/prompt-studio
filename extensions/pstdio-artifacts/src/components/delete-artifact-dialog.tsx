import { Button, CloseButton, Dialog, Portal, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { useArtifactTranslations } from "../translations";

interface DeleteArtifactDialogProps {
  title: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export const DeleteArtifactDialog = (props: DeleteArtifactDialogProps) => {
  const { title, onDelete, onClose } = props;
  const { t } = useArtifactTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const remove = async () => {
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root
      open
      closeOnInteractOutside={false}
      onOpenChange={(event) => {
        if (!event.open && !busy) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("reader.deleteTitle", "Delete “{{title}}”?", { title })}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={busy} aria-label={t("common.close", "Close")} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3">
                <Text>
                  {t(
                    "reader.deleteHint",
                    "This removes the artifact and all its saved versions. Your source files are kept.",
                  )}
                </Text>
                {error ? <AlertMessage status="error" title={error} /> : null}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Stack direction="row" gap="1">
                <Button disabled={busy} onClick={onClose}>
                  {t("common.close", "Close")}
                </Button>
                <Button loading={busy} variant="solid" colorPalette="red" onClick={() => void remove()}>
                  {t("reader.deleteConfirm", "Delete artifact")}
                </Button>
              </Stack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
