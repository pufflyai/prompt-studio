import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import { Folder } from "lucide-react";
import { ListRow } from "@/components/list-row/list-row";
import { ScrollArea } from "@/components/primitives/scroll-area";
import type { FolderPickerEntry } from "./folder-picker-dialog";

interface FolderPickerListProps {
  entries: FolderPickerEntry[];
  query: string;
  isLoading?: boolean;
  isUnavailable?: boolean;
  disabled: boolean;
  onNavigate: (path: string) => void;
}

export const FolderPickerList = (props: FolderPickerListProps) => {
  const { entries, query, isLoading, isUnavailable, disabled, onNavigate } = props;
  const styles = useSlotRecipe({ key: "folderPicker" })({});
  const folders = entries.filter(
    (entry) => entry.isDirectory && entry.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <ScrollArea css={styles.list}>
      <Box css={styles.rows} aria-label="Folders">
        {isLoading && <Text color="fg.muted">Loading folders...</Text>}
        {!isLoading && isUnavailable && (
          <Text color="fg.muted">Choose another drive, enter a folder path, or go Home.</Text>
        )}
        {!isLoading && !isUnavailable && folders.length === 0 && (
          <Text color="fg.muted">{query ? "No matching folders." : "This folder is empty."}</Text>
        )}
        {!isLoading &&
          folders.map((entry) => (
            <ListRow
              key={entry.path}
              id={entry.path}
              label={entry.name}
              icon={<Folder />}
              disabled={disabled}
              onActivate={() => onNavigate(entry.path)}
            />
          ))}
      </Box>
    </ScrollArea>
  );
};
