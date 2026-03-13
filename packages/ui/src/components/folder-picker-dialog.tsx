import { Button, Dialog, Menu, Stack, Text } from "@chakra-ui/react";
import { ChevronUp, FileText, Folder, FolderOpen, Home } from "lucide-react";
import { MenuItem } from "./menu-item";
import { ScrollArea } from "./scroll-area";

export interface FolderPickerDialogEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
}

interface FolderPickerDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  currentPath?: string;
  entries: FolderPickerDialogEntry[];
  selectedPath?: string | null;
  selectedPaths?: string[];
  isLoading?: boolean;
  error?: string;
  isSelectDisabled?: boolean;
  onClose: () => void;
  onSelect: () => void;
  onSelectHomeDirectory: () => void;
  onSelectParentDirectory: () => void;
  onEntryClick: (entry: FolderPickerDialogEntry) => void;
}

export type { FolderPickerDialogProps };

const getEntryIcon = (entry: FolderPickerDialogEntry) => {
  if (!entry.isDirectory) return FileText;
  if (entry.isGitRepo) return FolderOpen;
  return Folder;
};

type FolderPickerListEntryProps = {
  entry: FolderPickerDialogEntry;
  selectedPath: string | null;
  selectedPathSet: Set<string>;
  onEntryClick: (entry: FolderPickerDialogEntry) => void;
};

const FolderPickerListEntry = (props: FolderPickerListEntryProps) => {
  const { entry, selectedPath, selectedPathSet, onEntryClick } = props;
  const isAlreadySelected = entry.isGitRepo && selectedPathSet.has(entry.path);
  const isDisabled = !entry.isDirectory || isAlreadySelected;

  const handleClick = () => {
    if (isAlreadySelected) {
      return;
    }

    onEntryClick(entry);
  };

  return (
    <Menu.Root>
      <MenuItem
        primaryLabel={entry.name}
        leftIcon={getEntryIcon(entry)}
        tagLabel={entry.isGitRepo ? "Git repo" : undefined}
        tagColorPalette={entry.isGitRepo ? "green" : undefined}
        isDisabled={isDisabled}
        isSelected={selectedPath === entry.path}
        width="100%"
        maxWidth="100%"
        onClick={handleClick}
      />
    </Menu.Root>
  );
};

export const FolderPickerDialog = (props: FolderPickerDialogProps) => {
  const {
    open,
    title = "Select folder",
    description,
    currentPath = "",
    entries,
    selectedPath = null,
    selectedPaths = [],
    isLoading = false,
    error = "",
    isSelectDisabled = false,
    onClose,
    onSelect,
    onSelectHomeDirectory,
    onSelectParentDirectory,
    onEntryClick,
  } = props;

  const selectedPathSet = new Set(selectedPaths);

  return (
    <Dialog.Root closeOnInteractOutside={false} open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Stack gap="xs">
              <Text textStyle="heading/M">{title}</Text>
              {description ? (
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  {description}
                </Text>
              ) : null}
            </Stack>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="md">
              <Stack direction="row" gap="sm" align="center">
                <Button aria-label="Go to home directory" variant="outline" size="sm" onClick={onSelectHomeDirectory}>
                  <Home size={16} />
                </Button>
                <Button
                  aria-label="Go to parent directory"
                  variant="outline"
                  size="sm"
                  onClick={onSelectParentDirectory}
                  disabled={!currentPath || currentPath === "/"}
                >
                  <ChevronUp size={16} />
                </Button>
                <Text textStyle="paragraph/S/regular" color="fg.muted" flex="1" lineClamp={1}>
                  {currentPath || "Home"}
                </Text>
              </Stack>

              <ScrollArea
                borderWidth="1px"
                borderRadius="md"
                borderColor="border.muted"
                maxHeight="320px"
                contentProps={{ padding: "sm" }}
              >
                {isLoading ? (
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    Loading...
                  </Text>
                ) : error ? (
                  <Text textStyle="paragraph/S/regular" color="red.500">
                    {error}
                  </Text>
                ) : entries.length === 0 ? (
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    No entries found.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {entries.map((entry) => (
                      <FolderPickerListEntry
                        key={entry.path}
                        entry={entry}
                        selectedPath={selectedPath}
                        selectedPathSet={selectedPathSet}
                        onEntryClick={onEntryClick}
                      />
                    ))}
                  </Stack>
                )}
              </ScrollArea>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Stack direction="row" gap="sm">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onSelect} disabled={isSelectDisabled}>
                Select repository
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
