import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { type DragEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/primitives/empty-state";
import {
  buildColumns,
  buildFolderPathIds,
  type ColumnFileItem,
  findFirstFilePath,
  isSamePath,
  resolveActiveFileId,
} from "./column-file-paths";
import { ColumnItemRow } from "./column-item-row";

export interface ColumnFileBrowserProps<T extends ColumnFileItem> {
  items: T[];
  activePath?: T[];
  onFolderOpen?: (folder: T, path: T[]) => void;
  onFileOpen?: (file: T, path: T[]) => void;
  onDeleteItem?: (item: T, path: T[]) => void;
  onDownloadFile?: (file: T, path: T[]) => void;
  onDropFiles?: (files: File[], folder: T | null, path: T[]) => void;
  emptyLabel?: string;
  canDeleteItem?: (item: T, path: T[]) => boolean;
  onUploadClick?: () => void;
}

export const ColumnFileBrowser = <T extends ColumnFileItem>(props: ColumnFileBrowserProps<T>) => {
  const {
    items,
    activePath,
    emptyLabel = "This folder is empty.",
    onFolderOpen,
    onFileOpen,
    onDeleteItem,
    onDownloadFile,
    onDropFiles,
    canDeleteItem,
    onUploadClick,
  } = props;

  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const columns = buildColumns<T>(items, selectedPath);
  const firstFolder = items.find((item) => item.type === "folder") ?? null;
  const hasExternalPath = Boolean(activePath && activePath.length > 0);

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: DragEvent, folder: T | null, path: T[]) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer?.files ?? []);

    if (files.length === 0) return;

    onDropFiles?.(files, folder, path);
  };

  useEffect(() => {
    if (!activePath) return;

    const nextSelectedPath = buildFolderPathIds(activePath);
    const nextActiveFileId = resolveActiveFileId(activePath);
    const hasMatchingPath = isSamePath(nextSelectedPath, selectedPath);

    if (hasMatchingPath && nextActiveFileId === activeFileId) return;

    setSelectedPath(nextSelectedPath);
    setActiveFileId(nextActiveFileId);
  }, [activeFileId, activePath, selectedPath]);

  useEffect(() => {
    if (hasExternalPath) return;
    if (selectedPath.length > 0) return;
    if (activeFileId) return;

    const defaultFilePath = findFirstFilePath(items);

    if (defaultFilePath) {
      const folderPathIds = defaultFilePath.path.map((folder) => folder.id);
      const deepestFolder = defaultFilePath.path[defaultFilePath.path.length - 1] ?? null;

      if (folderPathIds.length > 0 && deepestFolder) {
        setSelectedPath(folderPathIds);
        onFolderOpen?.(deepestFolder, defaultFilePath.path);
      }

      return;
    }

    if (!firstFolder) return;

    setSelectedPath([firstFolder.id]);
    onFolderOpen?.(firstFolder, [firstFolder]);
  }, [activeFileId, firstFolder, hasExternalPath, items, onFolderOpen, selectedPath]);

  return (
    <Stack height="100%" direction="row" gap="0">
      {columns.map((column, columnIndex) => {
        const allowContextMenu = column.breadcrumb.length > 0 && (Boolean(onDeleteItem) || Boolean(onDownloadFile));
        const parentFolder = column.breadcrumb[column.breadcrumb.length - 1] ?? null;

        return (
          <Stack
            gap="xs"
            p="xs"
            height="100%"
            key={column.breadcrumb.map((item) => item.id).join("/") || "root"}
            minW="240px"
            maxW="320px"
            borderRightWidth="1px"
          >
            <HStack justify="flex-end" gap="0">
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {column.items.length} item{column.items.length === 1 ? "" : "s"}
              </Text>
            </HStack>

            <Stack
              gap="xs"
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, parentFolder, column.breadcrumb)}
            >
              {column.items.map((item) => (
                <ColumnItemRow
                  key={item.id}
                  item={item}
                  columnIndex={columnIndex}
                  breadcrumb={column.breadcrumb}
                  selectedFolderId={column.selectedFolderId}
                  activeFileId={activeFileId}
                  allowContextMenu={allowContextMenu}
                  canDeleteItem={canDeleteItem}
                  onFolderOpen={onFolderOpen}
                  onFileOpen={onFileOpen}
                  onDeleteItem={onDeleteItem}
                  onDownloadFile={onDownloadFile}
                  onDragOver={handleDragOver}
                  onDropToFolder={handleDrop}
                  onUpdateSelectedPath={setSelectedPath}
                  onUpdateActiveFileId={setActiveFileId}
                />
              ))}

              {column.items.length === 0 ? (
                <Box borderWidth="1px" borderColor="border.subtle" p="md" height="100%">
                  <EmptyState title={emptyLabel} size="sm" textAlign="left" alignItems="flex-start" height="100%">
                    {onUploadClick ? (
                      <Button size="sm" variant="outline" onClick={onUploadClick}>
                        Upload files
                      </Button>
                    ) : null}
                  </EmptyState>
                </Box>
              ) : null}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
};
