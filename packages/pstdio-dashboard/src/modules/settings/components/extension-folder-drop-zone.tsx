import { HStack, Icon, Spinner, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { FolderPlus } from "lucide-react";
import { type DragEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import { readDroppedFolder } from "./read-dropped-folder";

export interface ExtensionFolderDropZoneProps {
  /** Name of the folder being copied, while a copy is running. */
  addingName?: string;
  onDropFolder: (folder: DroppedExtensionFolder) => void;
}

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

export const ExtensionFolderDropZone = (props: ExtensionFolderDropZoneProps) => {
  const { addingName, onDropFolder } = props;
  const { t } = useTranslation("projects");
  const [dragging, setDragging] = useState(false);
  const adding = addingName !== undefined;

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

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (adding) return;

    // The browser only exposes dropped entries while the drop event runs, so take it before any await.
    const entry = event.dataTransfer.items[0]?.webkitGetAsEntry();
    if (!entry?.isDirectory) {
      toaster.create({ type: "error", title: t("projectSettings.extensionsPanel.dropZone.notFolder") });
      return;
    }

    try {
      onDropFolder(await readDroppedFolder(entry as FileSystemDirectoryEntry));
    } catch (error) {
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.dropZone.failed"),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Stack
      layerStyle={dragging ? "dropZone.active" : "dropZone.idle"}
      alignItems="center"
      gap="2xs"
      paddingX="lg"
      paddingY="md"
      color="fg.muted"
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
      data-testid="extension-folder-drop-zone"
    >
      <HStack gap="xs">
        {adding ? (
          <Spinner size="xs" />
        ) : (
          <Icon boxSize="4">
            <FolderPlus />
          </Icon>
        )}
        <Text textStyle="label/S/medium">
          {adding
            ? t("projectSettings.extensionsPanel.dropZone.uploading", { name: addingName })
            : t("projectSettings.extensionsPanel.dropZone.title")}
        </Text>
      </HStack>
      <Text textStyle="label/XS" color="fg.subtle">
        {t("projectSettings.extensionsPanel.dropZone.hint")}
      </Text>
    </Stack>
  );
};
