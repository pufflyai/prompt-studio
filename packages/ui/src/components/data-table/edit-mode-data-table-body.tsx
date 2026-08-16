import { Button, Icon, Table } from "@chakra-ui/react";
import { Plus, Trash2 } from "lucide-react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { EditModeDataTableCell } from "./edit-mode-data-table-cell";
import { EditModeSelectionCell } from "./edit-mode-data-table-selection";
import type { DataTableCellContext, DataTableEditModeColumn, DataTableEditModeConfig, RowData } from "./types";

interface ActiveCell {
  rowId: string;
  columnId: string;
  draft: string;
}

interface EditModeDataTableBodyProps {
  activeCell: ActiveCell | null;
  columns: DataTableEditModeColumn[];
  data: RowData[];
  editMode: DataTableEditModeConfig;
  enableSelection: boolean;
  isReadOnly: boolean;
  pageIndex: number;
  pageRows: RowData[];
  pageSize: number;
  selectedRowIds: Set<string>;
  showNewRow: boolean;
  onActivateCell: (cell: ActiveCell) => void;
  onAddRow: () => void;
  onCancelCell: () => void;
  onCommitCell: () => void;
  onDraftChange: (cell: ActiveCell) => void;
  onRemoveRow: (rowId: string) => void;
  onToggleRowSelection: (rowId: string, checked: boolean) => void;
  rowIdFor: (row: RowData, index: number) => string;
}

export const EditModeDataTableBody = (props: EditModeDataTableBodyProps) => {
  const {
    activeCell,
    columns,
    data,
    editMode,
    enableSelection,
    isReadOnly,
    pageIndex,
    pageRows,
    pageSize,
    selectedRowIds,
    showNewRow,
    onActivateCell,
    onAddRow,
    onCancelCell,
    onCommitCell,
    onDraftChange,
    onRemoveRow,
    onToggleRowSelection,
    rowIdFor,
  } = props;

  return (
    <Table.Body>
      {pageRows.map((row, visibleIndex) => {
        const rowIndex = pageIndex * pageSize + visibleIndex;
        const sourceIndex = data.indexOf(row);
        const rowId = rowIdFor(row, sourceIndex);
        const tableRow = (
          <Table.Row
            key={rowId}
            data-document-row="true"
            data-selected={selectedRowIds.has(rowId) ? "true" : undefined}
            aria-selected={selectedRowIds.has(rowId)}
            height="10"
            background="bg"
          >
            <Table.Cell
              data-column-id="rowIndex"
              height="10"
              padding="xs"
              textAlign="center"
              textStyle="paragraph/S/regular"
              background="bg.subtle"
              borderRightWidth="1px"
              borderBottomWidth="1px"
              borderColor="border.subtle"
            >
              {rowIndex + 1}
            </Table.Cell>
            {enableSelection ? (
              <EditModeSelectionCell
                checked={selectedRowIds.has(rowId)}
                onChange={(checked) => onToggleRowSelection(rowId, checked)}
              />
            ) : null}
            {columns.map((column) => {
              const context: DataTableCellContext = {
                row,
                rowId,
                columnId: column.id,
                value: row[column.id] ?? "",
              };
              const isActive = activeCell?.rowId === rowId && activeCell.columnId === column.id;
              return (
                <EditModeDataTableCell
                  key={column.id}
                  activeDraft={isActive ? activeCell?.draft : undefined}
                  column={column}
                  context={context}
                  editMode={editMode}
                  isActive={isActive}
                  isReadOnly={isReadOnly}
                  onActivate={() => onActivateCell({ rowId, columnId: column.id, draft: String(context.value ?? "") })}
                  onDraftChange={(draft) => onDraftChange({ rowId, columnId: column.id, draft })}
                  onSave={onCommitCell}
                  onCancel={onCancelCell}
                />
              );
            })}
            {!isReadOnly ? (
              <Table.Cell
                data-column-id="editControl"
                width="min-content"
                height="10"
                position="sticky"
                right="0"
                zIndex="1"
                background="bg"
                borderLeftWidth="1px"
                borderBottomWidth="1px"
                borderColor="border.subtle"
              />
            ) : null}
          </Table.Row>
        );

        if (isReadOnly) return tableRow;

        return (
          <ResourceContextMenu
            key={rowId}
            contentMinWidth="12rem"
            actions={[
              {
                key: "delete-row",
                label: "Delete row",
                icon: <Icon as={Trash2} boxSize="14px" />,
                onClick: () => onRemoveRow(rowId),
              },
            ]}
          >
            {tableRow}
          </ResourceContextMenu>
        );
      })}
      {!isReadOnly && showNewRow ? (
        <Table.Row>
          <Table.Cell colSpan={columns.length + 2 + (enableSelection ? 1 : 0)} padding="0">
            <Button
              size="xs"
              variant="ghost-static"
              width="100%"
              justifyContent="flex-start"
              paddingX="xs"
              color="fg.muted"
              onClick={onAddRow}
            >
              <Icon as={Plus} />
              New row
            </Button>
          </Table.Cell>
        </Table.Row>
      ) : null}
    </Table.Body>
  );
};
