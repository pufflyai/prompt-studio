import { Box, IconButton, Menu } from "@chakra-ui/react";
import {
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  List,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Rows2,
  Settings2,
  SquareSplitHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { ListRow } from "../list-row/list-row";
import type { ChangedFilesViewMode, DiffViewMode } from "./types";

interface DiffViewerOptionsMenuProps {
  isTreePanelOpen: boolean;
  hasFilePaths: boolean;
  viewMode: ChangedFilesViewMode;
  diffViewMode: DiffViewMode;
  isExpandAllDisabled: boolean;
  isCollapseAllDisabled: boolean;
  onToggleTreePanel: () => void;
  onViewModeChange: (viewMode: ChangedFilesViewMode) => void;
  onDiffViewModeChange: (diffViewMode: DiffViewMode) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

interface DiffViewerMenuItemProps {
  id: string;
  label: string;
  icon: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onActivate: () => void;
}

const SelectionIndicator = (props: { selected: boolean }) => (
  <Box w="14px" flexShrink={0} display="flex" justifyContent="center">
    {props.selected ? <Check size={14} /> : null}
  </Box>
);

const DiffViewerMenuItem = (props: DiffViewerMenuItemProps) => {
  const { id, label, icon, selected, disabled, onActivate } = props;

  return (
    <Menu.Item value={id} disabled={disabled} asChild>
      <ListRow
        asChild
        role={selected === undefined ? undefined : "menuitemradio"}
        aria-checked={selected}
        variant="full-width"
        id={id}
        icon={icon}
        label={label}
        disabled={disabled}
        isSelected={selected}
        endContent={selected === undefined ? undefined : <SelectionIndicator selected={selected} />}
        onActivate={onActivate}
      />
    </Menu.Item>
  );
};

export const DiffViewerOptionsMenu = (props: DiffViewerOptionsMenuProps) => {
  const {
    isTreePanelOpen,
    hasFilePaths,
    viewMode,
    diffViewMode,
    isExpandAllDisabled,
    isCollapseAllDisabled,
    onToggleTreePanel,
    onViewModeChange,
    onDiffViewModeChange,
    onExpandAll,
    onCollapseAll,
  } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton aria-label="Diff view options" variant="ghost" size="sm">
          <Settings2 size={14} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="190px" bg="bg" p="0" gap="0">
          <DiffViewerMenuItem
            id="toggle-file-tree"
            icon={isTreePanelOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            label={isTreePanelOpen ? "Hide file tree" : "Show file tree"}
            onActivate={onToggleTreePanel}
          />
          <Menu.Separator />
          {hasFilePaths ? (
            <>
              <DiffViewerMenuItem
                id="nested"
                icon={<ListTree size={14} />}
                label="Nested"
                selected={viewMode === "nested"}
                onActivate={() => onViewModeChange("nested")}
              />
              <DiffViewerMenuItem
                id="flat"
                icon={<List size={14} />}
                label="Flat"
                selected={viewMode === "flat"}
                onActivate={() => onViewModeChange("flat")}
              />
              <Menu.Separator />
            </>
          ) : null}
          <DiffViewerMenuItem
            id="unified"
            icon={<Rows2 size={14} />}
            label="Unified"
            selected={diffViewMode === "unified"}
            onActivate={() => onDiffViewModeChange("unified")}
          />
          <DiffViewerMenuItem
            id="split"
            icon={<SquareSplitHorizontal size={14} />}
            label="Split"
            selected={diffViewMode === "split"}
            onActivate={() => onDiffViewModeChange("split")}
          />
          <Menu.Separator />
          <DiffViewerMenuItem
            id="expand-all"
            icon={<ChevronsUpDown size={14} />}
            label="Expand all"
            disabled={isExpandAllDisabled}
            onActivate={onExpandAll}
          />
          <DiffViewerMenuItem
            id="collapse-all"
            icon={<ChevronsDownUp size={14} />}
            label="Collapse all"
            disabled={isCollapseAllDisabled}
            onActivate={onCollapseAll}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
