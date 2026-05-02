import { Box, Button, HStack, Icon, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { type DragEvent, useEffect, useState } from "react";

import { EmptyState } from "./empty-state";
import { ListRow } from "./list-row/list-row";

export interface ColumnFileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  meta?: string;
  children?: ColumnFileItem[];
}

interface ColumnData<T extends ColumnFileItem> {
  items: T[];
  selectedFolderId?: string;
  breadcrumb: T[];
}

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

const buildColumns = <T extends ColumnFileItem>(items: T[], selectedPath: string[]): ColumnData<T>[] => {
  const columns: ColumnData<T>[] = [];

  let currentItems = items;
  let breadcrumb: T[] = [];

  columns.push({
    items: currentItems,
    selectedFolderId: selectedPath[0],
    breadcrumb,
  });

  for (let index = 0; index < selectedPath.length; index++) {
    const folderId = selectedPath[index];
    const folder = currentItems.find((item) => item.id === folderId && item.type === "folder");

    if (!folder) break;

    breadcrumb = [...breadcrumb, folder];
    currentItems = (folder.children as T[] | undefined) ?? [];

    columns.push({
      items: currentItems,
      selectedFolderId: selectedPath[index + 1],
      breadcrumb,
    });
  }

  return columns;
};

const findFirstFilePath = <T extends ColumnFileItem>(items: T[]) => {
  const stack: Array<{ item: T; path: T[] }> = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    stack.push({ item: items[index] as T, path: [] });
  }

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) break;

    const { item, path } = current;

    if (item.type === "file") {
      if (path.length === 0) continue;

      return { path, file: item };
    }

    const children = item.children as T[] | undefined;

    if (!children || children.length === 0) continue;

    const nextPath = [...path, item];

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ item: children[index] as T, path: nextPath });
    }
  }

  return null;
};

const buildFolderPathIds = <T extends ColumnFileItem>(path: T[]) => {
  return path.filter((item) => item.type === "folder").map((item) => item.id);
};

const resolveActiveFileId = <T extends ColumnFileItem>(path: T[]) => {
  const lastItem = path[path.length - 1] ?? null;

  if (lastItem?.type !== "file") {
    return null;
  }

  return lastItem.id;
};

const isSamePath = (nextPath: string[], currentPath: string[]) => {
  if (nextPath.length !== currentPath.length) return false;

  return nextPath.every((value, index) => value === currentPath[index]);
};

interface ColumnItemRowProps<T extends ColumnFileItem> {
  item: T;
  columnIndex: number;
  breadcrumb: T[];
  selectedFolderId?: string;
  activeFileId: string | null;
  allowContextMenu: boolean;
  canDeleteItem?: (item: T, path: T[]) => boolean;
  onFolderOpen?: (folder: T, path: T[]) => void;
  onFileOpen?: (file: T, path: T[]) => void;
  onDeleteItem?: (item: T, path: T[]) => void;
  onDownloadFile?: (file: T, path: T[]) => void;
  onDragOver: (event: DragEvent) => void;
  onDropToFolder: (event: DragEvent, folder: T | null, path: T[]) => void;
  onUpdateSelectedPath: (nextPath: string[]) => void;
  onUpdateActiveFileId: (nextActiveFileId: string | null) => void;
}

const ColumnItemRow = <T extends ColumnFileItem>(props: ColumnItemRowProps<T>) => {
  const {
    item,
    columnIndex,
    breadcrumb,
    selectedFolderId,
    activeFileId,
    allowContextMenu,
    canDeleteItem,
    onFolderOpen,
    onFileOpen,
    onDeleteItem,
    onDownloadFile,
    onDragOver,
    onDropToFolder,
    onUpdateSelectedPath,
    onUpdateActiveFileId,
  } = props;

  const isFolder = item.type === "folder";
  const itemPath = [...breadcrumb, item];
  const canDownloadFile = Boolean(onDownloadFile) && !isFolder;
  const allowDelete = Boolean(onDeleteItem) && (canDeleteItem ? canDeleteItem(item, itemPath) : true);
  const hasContextActions = allowContextMenu && (canDownloadFile || allowDelete);
  const isSelectedFolder = selectedFolderId === item.id;
  const isActiveFile = !isFolder && activeFileId === item.id;

  const handleItemClick = () => {
    const basePathIds = breadcrumb.slice(0, columnIndex).map((entry) => entry.id);

    if (isFolder) {
      const nextPath = [...basePathIds, item.id];
      onUpdateSelectedPath(nextPath);
      onUpdateActiveFileId(null);
      onFolderOpen?.(item, itemPath);
      return;
    }

    onUpdateSelectedPath(basePathIds);
    onUpdateActiveFileId(item.id);
    onFileOpen?.(item, itemPath);
  };

  const handleDeleteClick = () => {
    if (!allowDelete) return;
    onDeleteItem?.(item, itemPath);
  };

  const handleDownloadClick = () => {
    if (!canDownloadFile) return;
    onDownloadFile?.(item, itemPath);
  };

  const content = (
    <ListRow
      variant="compact"
      isSelected={isSelectedFolder || isActiveFile}
      id={item.id}
      label={item.name}
      description={item.meta}
      icon={<Icon as={isFolder ? Folder : FileText} boxSize="14px" />}
      endContent={isFolder ? <Icon as={ChevronRight} boxSize="14px" /> : undefined}
      onActivate={handleItemClick}
    />
  );

  const itemSurface = (
    <Box
      width="100%"
      onDragOver={isFolder ? onDragOver : undefined}
      onDrop={(event) => onDropToFolder(event, item, itemPath)}
    >
      {content}
    </Box>
  );

  if (!hasContextActions) {
    return <Menu.Root>{itemSurface}</Menu.Root>;
  }

  return (
    <Menu.Root>
      <Menu.ContextTrigger asChild>{itemSurface}</Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="180px" bg="bg" zIndex="popover">
            {canDownloadFile ? (
              <Menu.Item value="download" onClick={handleDownloadClick}>
                Download
              </Menu.Item>
            ) : null}
            {allowDelete ? (
              <Menu.Item value="delete" color="fg.error" onClick={handleDeleteClick}>
                Delete
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

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
                <Box borderWidth="1px" borderColor="border.muted" p="md" height="100%">
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
