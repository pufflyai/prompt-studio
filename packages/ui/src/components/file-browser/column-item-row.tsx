import { Box, Icon, Menu, Portal } from "@chakra-ui/react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import type { DragEvent } from "react";
import { ListRow } from "@/components/list-row/list-row";
import type { ColumnFileItem } from "./column-file-paths";

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

export const ColumnItemRow = <T extends ColumnFileItem>(props: ColumnItemRowProps<T>) => {
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
