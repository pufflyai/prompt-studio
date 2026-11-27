import { HStack, Icon, Spinner, Stack, Text } from "@chakra-ui/react";
import { FolderPlus } from "lucide-react";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useActionError } from "@/shared/components/use-action-error";

export interface ExtensionFolderDropZoneProps {
  /** Status text for the folder copy while it is running. */
  addingLabel?: string;
  onDropFolder: (directory: FileSystemDirectoryEntry) => void;
}

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

export const ExtensionFolderDropZone = (props: ExtensionFolderDropZoneProps) => {
  const { addingLabel, onDropFolder } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const { t } = useTranslation("projects");
  const [dragging, setDragging] = useState(false);
  const adding = addingLabel !== undefined;

  const handleDragOver = (event: DragEvent) => {
    if (adding || !carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    // Moving onto a child element fires dragleave on the zone too; only leaving the zone counts.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (adding) return;
    clearError();

    // Capture the directory during the drop event so Retry can read it again after edits.
    const entry = event.dataTransfer.items[0]?.webkitGetAsEntry();
    if (!entry?.isDirectory) {
      showError({ title: t("projectSettings.extensionsPanel.dropZone.notFolder") });
      return;
    }

    onDropFolder(entry as FileSystemDirectoryEntry);
  };

  return (
    <Stack
      position="relative"
      layerStyle={dragging ? "dropZone.active" : "dropZone.idle"}
      alignItems="center"
      gap="2xs"
      paddingX="lg"
      paddingY="md"
      color="fg.muted"
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="extension-folder-drop-zone"
    >
      {errorNotice}
      <HStack gap="xs">
        {adding ? (
          <Spinner size="xs" />
        ) : (
          <Icon boxSize="4">
            <FolderPlus />
          </Icon>
        )}
        <Text textStyle="label/S/medium">{addingLabel ?? t("projectSettings.extensionsPanel.dropZone.title")}</Text>
      </HStack>
      <Text textStyle="label/XS" color="fg.subtle">
        {t("projectSettings.extensionsPanel.dropZone.hint")}
      </Text>
    </Stack>
  );
};
