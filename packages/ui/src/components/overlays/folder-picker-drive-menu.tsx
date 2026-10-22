import { Button, Text, useSlotRecipe } from "@chakra-ui/react";
import { ChevronDown, HardDrive } from "lucide-react";
import { SearchableMenu } from "./searchable-menu";

export interface FolderPickerDrive {
  name: string;
  path: string;
}

interface FolderPickerDriveMenuProps {
  drives: FolderPickerDrive[];
  currentPath: string;
  disabled: boolean;
  onNavigate: (path: string) => void;
}

export const FolderPickerDriveMenu = (props: FolderPickerDriveMenuProps) => {
  const { drives, currentPath, disabled, onNavigate } = props;
  const styles = useSlotRecipe({ key: "folderPicker" })({});
  const currentRoot = currentPath
    .match(/^[a-z]:[\\/]/i)?.[0]
    .replaceAll("\\", "/")
    .toUpperCase();
  const selected = drives.find((drive) => drive.path.replaceAll("\\", "/").toUpperCase() === currentRoot);
  return (
    <SearchableMenu
      trigger={
        <Button size="sm" variant="ghost" css={styles.driveTrigger} aria-label="Drive" disabled={disabled}>
          <HardDrive />
          {selected?.name ?? currentRoot?.slice(0, 2) ?? "Drive"}
          <ChevronDown />
        </Button>
      }
      items={drives.map((drive) => ({
        id: drive.path,
        label: drive.name,
        icon: HardDrive,
        isSelected: drive === selected,
        onSelect: () => onNavigate(drive.path),
      }))}
      header={<Text css={styles.driveLabel}>Drives</Text>}
      width="60"
      showSearch={false}
      searchPlaceholder="Search drives"
      emptyState="No drives available."
      portalled={false}
      positioning={{ placement: "bottom-start", strategy: "fixed", hideWhenDetached: true }}
    />
  );
};
