import { Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { KanbanRendererToolbar } from "../kanban-renderer/kanban-renderer-toolbar";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";
import { SelectionToolbar } from "./selection-toolbar";
import type { DataTableSelectionAction, RowData } from "./types";

interface DataTableHeaderProps {
  rows: KanbanRendererRow[];
  attributes: AttributeDescriptor[];
  storageKey: string;
  selectedCount: number;
  totalCount: number;
  visibleCount: number;
  actions: DataTableSelectionAction[];
  selectedRows: RowData[];
  columnControl: ReactNode;
  onClearSelection: () => void;
  onSelectAll: () => void;
}

export const DataTableHeader = (props: DataTableHeaderProps) => {
  const {
    rows,
    attributes,
    storageKey,
    selectedCount,
    totalCount,
    visibleCount,
    actions,
    selectedRows,
    columnControl,
    onClearSelection,
    onSelectAll,
  } = props;

  const leading =
    selectedCount > 0 ? (
      <SelectionToolbar
        selectedCount={selectedCount}
        totalCount={totalCount}
        onClearSelection={onClearSelection}
        onSelectAll={onSelectAll}
        actions={actions}
        selectedRows={selectedRows}
      />
    ) : (
      <Text px="xs" textStyle="label/S/regular" color="fg.muted">
        {visibleCount} rows
      </Text>
    );

  return (
    <KanbanRendererToolbar
      rows={rows}
      storageKey={storageKey}
      attributes={attributes}
      defaultSettings={{ viewMode: "list" }}
      leading={leading}
      displayControl={columnControl}
    />
  );
};
