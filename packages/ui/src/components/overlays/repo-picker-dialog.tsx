import { Badge, Button, Dialog, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { ChevronUp, FileText, Folder, FolderOpen, Home, Search } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { ScrollArea } from "@/components/primitives/scroll-area";

export interface RepoPickerDialogEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
}

interface RepoPickerDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  currentPath?: string;
  entries: RepoPickerDialogEntry[];
  selectedPath?: string | null;
  selectedPaths?: string[];
  isLoading?: boolean;
  error?: string;
  isSelectDisabled?: boolean;
  onClose: () => void;
  onSelect: () => void;
  onSelectHomeDirectory: () => void;
  onSelectParentDirectory: () => void;
  onEntryClick: (entry: RepoPickerDialogEntry) => void;
}

export type { RepoPickerDialogProps };

const getEntryIcon = (entry: RepoPickerDialogEntry) => {
  if (!entry.isDirectory) return FileText;
  if (entry.isGitRepo) return FolderOpen;
  return Folder;
};

const filterEntries = (entries: RepoPickerDialogEntry[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) => `${entry.name} ${entry.path}`.toLowerCase().includes(normalizedQuery));
};

type RepoPickerListEntryProps = {
  entry: RepoPickerDialogEntry;
  selectedPath: string | null;
  selectedPathSet: Set<string>;
  onEntryClick: (entry: RepoPickerDialogEntry) => void;
};

const RepoPickerListEntry = (props: RepoPickerListEntryProps) => {
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
    <ListRow
      variant="compact"
      isSelected={selectedPath === entry.path}
      id={entry.path}
      label={entry.name}
      icon={<Icon as={getEntryIcon(entry)} boxSize="16px" />}
      endContent={
        entry.isGitRepo ? (
          <Badge
            textStyle="label/XS/medium"
            px="xs"
            py="2px"
            colorPalette="green"
            variant="subtle"
            pointerEvents="none"
          >
            Git repo
          </Badge>
        ) : undefined
      }
      disabled={isDisabled}
      onActivate={handleClick}
    />
  );
};

const focusInlinePickerOption = (event: KeyboardEvent<HTMLDivElement>) => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    return;
  }

  const options = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="option"]:not(:disabled)'),
  );

  if (options.length === 0) {
    return;
  }

  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = (() => {
    if (event.key === "Home") return 0;
    if (event.key === "End") return options.length - 1;
    if (event.key === "ArrowUp") return currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
    return currentIndex < 0 || currentIndex === options.length - 1 ? 0 : currentIndex + 1;
  })();

  event.preventDefault();
  options[nextIndex]?.focus();
};

export const RepoPickerDialog = (props: RepoPickerDialogProps) => {
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

  const [query, setQuery] = useState("");
  const selectedPathSet = new Set(selectedPaths);
  const filteredEntries = filterEntries(entries, query);
  const searchScope = currentPath || "Home";

  useEffect(() => {
    if (!open || !searchScope) return;
    setQuery("");
  }, [open, searchScope]);

  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      closeOnInteractOutside={false}
      open={open}
      onOpenChange={(details) => !details.open && onClose()}
    >
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
                <Text
                  data-testid="folder-picker-path"
                  textStyle="paragraph/S/regular"
                  color="fg.muted"
                  flex="1"
                  lineClamp={1}
                >
                  {searchScope}
                </Text>
              </Stack>

              <Stack gap="0" borderWidth="1px" borderRadius="md" borderColor="border.subtle" overflow="hidden">
                <InputGroup
                  startElement={<Search size={14} />}
                  width="full"
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                >
                  <Input
                    mx="xs"
                    value={query}
                    placeholder="Search repositories"
                    aria-label="Search repositories"
                    autoComplete="off"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </InputGroup>
                {isLoading ? (
                  <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
                    Loading...
                  </Text>
                ) : error ? (
                  <Text textStyle="paragraph/S/regular" color="red.500" p="sm">
                    {error}
                  </Text>
                ) : filteredEntries.length === 0 ? (
                  <Text textStyle="paragraph/S/regular" color="fg.muted" p="sm">
                    No entries found.
                  </Text>
                ) : (
                  <ScrollArea maxHeight="320px" contentProps={{ padding: "sm" }}>
                    <Stack gap="xs" role="listbox" aria-label="Repository folders" onKeyDown={focusInlinePickerOption}>
                      {filteredEntries.map((entry) => (
                        <RepoPickerListEntry
                          key={entry.path}
                          entry={entry}
                          selectedPath={selectedPath}
                          selectedPathSet={selectedPathSet}
                          onEntryClick={onEntryClick}
                        />
                      ))}
                    </Stack>
                  </ScrollArea>
                )}
              </Stack>
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
