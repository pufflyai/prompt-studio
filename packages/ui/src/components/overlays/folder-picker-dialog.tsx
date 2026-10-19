import { Box, Button, Dialog, Input, InputGroup, Text, useSlotRecipe } from "@chakra-ui/react";
import { ArrowUp, FolderPlus, Home, Search } from "lucide-react";
import { useState } from "react";
import { type FolderPickerDrive, FolderPickerDriveMenu } from "./folder-picker-drive-menu";
import { FolderPickerList } from "./folder-picker-list";

export interface FolderPickerEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}
export interface FolderPickerProps {
  currentPath: string;
  entries: FolderPickerEntry[];
  drives?: FolderPickerDrive[];
  isUnavailable?: boolean;
  isLoading?: boolean;
  isOpening?: boolean;
  error?: string;
  onClose: () => void;
  onSelect: () => void;
  onNavigate: (path: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
}

export const FolderPicker = (props: FolderPickerProps) => {
  const {
    currentPath,
    entries,
    drives = [],
    isUnavailable,
    isLoading,
    isOpening,
    error,
    onClose,
    onSelect,
    onNavigate,
    onCreateFolder,
  } = props;
  const styles = useSlotRecipe({ key: "folderPicker" })({});
  const [path, setPath] = useState(currentPath);
  const [previousPath, setPreviousPath] = useState(currentPath);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  if (currentPath !== previousPath) {
    setPreviousPath(currentPath);
    setPath(currentPath);
    setQuery("");
  }
  const normalizedPath = currentPath.replaceAll("\\", "/");
  const root = normalizedPath.match(/^\/\/[^/]+\/[^/]+/)?.[0] ?? normalizedPath.match(/^[a-z]:\//i)?.[0] ?? "/";
  const ancestor = normalizedPath.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
  const parent = ancestor.length < root.length ? root : ancestor;
  const atRoot = normalizedPath.replace(/\/+$/, "") === root.replace(/\/+$/, "");
  const navigate = (path: string) => {
    setCreating(false);
    setFolderName("");
    onNavigate(path);
  };
  const createFolder = async () => {
    if (!folderName.trim()) return;
    setSaving(true);
    try {
      await onCreateFolder(folderName);
      setCreating(false);
      setFolderName("");
    } catch {
      /* The host displays the error. */
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Dialog.Header css={styles.header}>
        <Dialog.Title>Open project folder</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body css={styles.body}>
        <Box css={styles.navigation}>
          <Button
            size="sm"
            variant="outline"
            css={styles.navigationButton}
            aria-label="Go to home directory"
            disabled={isLoading || isOpening || saving}
            onClick={() => navigate("~")}
          >
            <Home />
          </Button>
          <Button
            size="sm"
            variant="outline"
            css={styles.navigationButton}
            aria-label="Go to parent directory"
            disabled={isLoading || isOpening || saving || atRoot || !currentPath || isUnavailable}
            onClick={() => navigate(parent)}
          >
            <ArrowUp />
          </Button>
          {drives.length > 0 && (
            <FolderPickerDriveMenu
              drives={drives}
              currentPath={currentPath}
              disabled={Boolean(isLoading || isOpening || saving)}
              onNavigate={navigate}
            />
          )}
          <Input
            css={styles.path}
            size="sm"
            variant="borderless"
            title={path}
            aria-label="Folder path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") navigate(path);
            }}
            disabled={isLoading || isOpening || saving}
          />
          {!creating && (
            <Button
              variant="outline"
              size="sm"
              disabled={!currentPath || isUnavailable || isLoading || isOpening}
              onClick={() => setCreating(true)}
            >
              <FolderPlus />
              New folder
            </Button>
          )}
        </Box>
        {!creating && (
          <InputGroup css={styles.filter} startElement={<Search />}>
            <Input
              size="sm"
              aria-label="Filter folders"
              placeholder="Filter folders"
              value={query}
              disabled={isUnavailable}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        )}
        {creating && (
          <Box css={styles.creation}>
            <Input
              size="sm"
              aria-label="New folder name"
              placeholder="New folder name"
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createFolder();
              }}
            />
            <Button size="sm" variant="primary" disabled={!folderName.trim()} loading={saving} onClick={createFolder}>
              <FolderPlus />
              Create folder
            </Button>
          </Box>
        )}
        {error && (
          <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
            {error}
          </Text>
        )}
        <FolderPickerList
          entries={entries}
          query={query}
          isLoading={isLoading}
          isUnavailable={isUnavailable}
          disabled={Boolean(isLoading || isOpening || saving)}
          onNavigate={navigate}
        />
      </Dialog.Body>
      <Dialog.Footer css={styles.footer}>
        <Button size="sm" variant="outline" onClick={onClose} disabled={isLoading || isOpening || saving}>
          Cancel
        </Button>
        {!creating && (
          <Button
            size="sm"
            variant="primary"
            onClick={onSelect}
            loading={isOpening}
            disabled={!currentPath || isUnavailable || isLoading || saving}
          >
            Open folder
          </Button>
        )}
      </Dialog.Footer>
    </>
  );
};
export const FolderPickerDialog = (props: FolderPickerProps & { open: boolean }) => {
  const styles = useSlotRecipe({ key: "folderPicker" })({});
  return (
    <Dialog.Root
      placement="center"
      scrollBehavior="inside"
      open={props.open}
      onOpenChange={(event) => {
        if (!event.open) props.onClose();
      }}
      closeOnInteractOutside={false}
      lazyMount
      unmountOnExit
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content css={styles.content}>
          <FolderPicker {...props} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
