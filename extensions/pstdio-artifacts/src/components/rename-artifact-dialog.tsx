import { Button, Dialog, Field, Input, Portal, Stack } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import { useArtifactTranslations } from "../translations";

interface RenameArtifactDialogProps {
  name: string;
  onRename: (name: string) => Promise<void>;
  onClose: () => void;
}
export const RenameArtifactDialog = (props: RenameArtifactDialogProps) => {
  const { name, onRename, onClose } = props;
  const { t } = useArtifactTranslations();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog.Root
      open
      onOpenChange={(event) => {
        if (!event.open && !busy) onClose();
      }}
      initialFocusEl={() => document.querySelector<HTMLInputElement>('[name="artifact-name"]')}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError(undefined);
                try {
                  await onRename(value);
                  onClose();
                } catch (error) {
                  setError(error instanceof Error ? error.message : String(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Dialog.Header>
                <Dialog.Title>{t("rename.title", "Rename artifact")}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="sm">
                  <Field.Root>
                    <Field.Label>{t("rename.name", "Artifact name")}</Field.Label>
                    <Input name="artifact-name" value={value} onChange={(event) => setValue(event.target.value)} />
                  </Field.Root>
                  {error ? <AlertMessage status="error" title={error} /> : null}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="ghost" disabled={busy} onClick={onClose}>
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button type="submit" loading={busy} disabled={!value.trim()}>
                  {t("common.save", "Save")}
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
