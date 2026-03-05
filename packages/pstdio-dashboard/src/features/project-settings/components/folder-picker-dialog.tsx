import { Button, CloseButton, Dialog, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface FolderPickerDialogProps {
  open: boolean;
  value?: string;
  title?: string;
  description?: string;
  selectedPaths?: string[];
  onClose: () => void;
  onSelect: (path: string | null) => void;
}

export const FolderPickerDialog = (props: FolderPickerDialogProps) => {
  const { open, value, title = "Select folder", description, selectedPaths = [], onClose, onSelect } = props;
  const { t } = useTranslation("common");
  const [path, setPath] = useState(value ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPath(value ?? "");
      setError("");
    }
  }, [open, value]);

  const handleSelect = () => {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      setError("Path is required.");
      return;
    }

    if (selectedPaths.includes(trimmedPath)) {
      setError("Repository already selected.");
      return;
    }

    onSelect(trimmedPath);
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{title}</Text>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="sm">
              {description ? (
                <Text textStyle="paragraph/S/regular" color="foreground.secondary">
                  {description}
                </Text>
              ) : null}
              <Input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="~/path/to/repository"
                autoFocus
              />
              {error ? (
                <Text textStyle="label/XS/regular" color="red.500">
                  {error}
                </Text>
              ) : (
                <Text textStyle="label/XS/regular" color="foreground.secondary">
                  {t("folderPicker.legend")}
                </Text>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Stack direction="row" gap="sm">
              <Button variant="outline" onClick={onClose}>
                {t("buttons.cancel")}
              </Button>
              <Button onClick={handleSelect}>{t("folderPicker.selectPath")}</Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
