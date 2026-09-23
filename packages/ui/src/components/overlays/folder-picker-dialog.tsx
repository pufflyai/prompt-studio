import { Button, Dialog, Input, Stack, Text } from "@chakra-ui/react";
import { ArrowUp, Folder, FolderPlus, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { ScrollArea } from "@/components/primitives/scroll-area";

export interface FolderPickerEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}
export interface FolderPickerProps {
  currentPath: string;
  entries: FolderPickerEntry[];
  isLoading?: boolean;
  isOpening?: boolean;
  error?: string;
  onClose: () => void;
  onSelect: () => void;
  onNavigate: (path: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
}

export const FolderPicker = (props: FolderPickerProps) => {
  const { currentPath, entries, isLoading, isOpening, error, onClose, onSelect, onNavigate, onCreateFolder } = props;
  const [path, setPath] = useState(currentPath);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setPath(currentPath);
    setQuery("");
  }, [currentPath]);
  const folders = entries.filter(
    (entry) => entry.isDirectory && entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const normalizedPath = currentPath.replaceAll("\\", "/");
  const root = normalizedPath.match(/^\/\/[^/]+\/[^/]+/)?.[0] ?? normalizedPath.match(/^[a-z]:\//i)?.[0] ?? "/";
  const ancestor = normalizedPath.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
  const parent = ancestor.length < root.length ? root : ancestor;
  const atRoot = normalizedPath.replace(/\/+$/, "") === root.replace(/\/+$/, "");
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
      <Dialog.Header>
        <Dialog.Title>Open project folder</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Stack gap="md">
          <Stack direction="row" gap="sm">
            <Button
              size="sm"
              variant="outline"
              aria-label="Go to home directory"
              disabled={isLoading || isOpening}
              onClick={() => onNavigate("~")}
            >
              <Home />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label="Go to parent directory"
              disabled={isLoading || isOpening || atRoot}
              onClick={() => onNavigate(parent)}
            >
              <ArrowUp />
            </Button>
            <Input
              aria-label="Folder path"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onNavigate(path);
              }}
              disabled={isLoading || isOpening}
            />
          </Stack>
          <Stack direction="row" gap="sm">
            <Input
              aria-label="Filter folders"
              placeholder="Filter folders"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!currentPath || isLoading || isOpening}
              onClick={() => setCreating(true)}
            >
              <FolderPlus />
              New folder
            </Button>
          </Stack>
          {creating && (
            <Stack direction="row" gap="sm">
              <Input
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
                Create folder
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </Stack>
          )}
          {error && (
            <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
              {error}
            </Text>
          )}
          <ScrollArea maxHeight="xs" contentProps={{ minHeight: "3xs" }}>
            <Stack gap="xs" aria-label="Folders">
              {isLoading ? (
                <Text color="fg.muted">Loading folders...</Text>
              ) : folders.length === 0 ? (
                <Text color="fg.muted">{query ? "No matching folders." : "This folder is empty."}</Text>
              ) : (
                folders.map((entry) => (
                  <ListRow
                    key={entry.path}
                    id={entry.path}
                    variant="compact"
                    label={entry.name}
                    icon={<Folder />}
                    disabled={isLoading || isOpening}
                    onActivate={() => onNavigate(entry.path)}
                  />
                ))
              )}
            </Stack>
          </ScrollArea>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            Sessions work directly in this folder and share its files.
          </Text>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onClick={onClose} disabled={isLoading || isOpening}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSelect} loading={isOpening} disabled={!currentPath || isLoading || saving}>
          Open folder
        </Button>
      </Dialog.Footer>
    </>
  );
};
export const FolderPickerDialog = (props: FolderPickerProps & { open: boolean }) => (
  <Dialog.Root
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
      <Dialog.Content>
        <FolderPicker {...props} />
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Root>
);
