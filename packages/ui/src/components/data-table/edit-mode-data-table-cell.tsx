import { Box, Table } from "@chakra-ui/react";
import { type KeyboardEvent, type ReactNode, useRef } from "react";
import { EditModeCellEditor } from "./edit-mode-data-table-editors";
import type { DataTableCellContext, DataTableEditModeColumn, DataTableEditModeConfig } from "./types";

interface EditModeDataTableCellProps {
  activeDraft?: string;
  column: DataTableEditModeColumn;
  context: DataTableCellContext;
  editMode: DataTableEditModeConfig;
  isActive: boolean;
  isReadOnly: boolean;
  onActivate: () => void;
  onCancel: () => void;
  onDraftChange: (draft: string) => void;
  onSave: () => void;
}

export const EditModeDataTableCell = (props: EditModeDataTableCellProps) => {
  const {
    activeDraft = "",
    column,
    context,
    editMode,
    isActive,
    isReadOnly,
    onActivate,
    onCancel,
    onDraftChange,
    onSave,
  } = props;
  const cellRef = useRef<HTMLTableCellElement>(null);
  const isEditable = !isReadOnly && (editMode.isCellEditable?.(context) ?? true);
  let content: ReactNode;

  if (isActive) {
    const customEditor = editMode.renderCellEditor?.({ context, value: activeDraft, onChange: onDraftChange });
    content = (
      <EditModeCellEditor
        anchorRef={cellRef}
        draft={activeDraft}
        customEditor={customEditor}
        onChange={onDraftChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  } else {
    content = (
      <Box width="100%" minHeight="5" textAlign="inherit">
        {editMode.renderCell?.(context) ?? String(context.value ?? "")}
      </Box>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    if (!isEditable || isActive || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onActivate();
  };

  return (
    <Table.Cell
      ref={cellRef}
      data-column-id={column.id}
      data-editable={String(isEditable)}
      data-editing={isActive ? "true" : undefined}
      padding={isActive ? "0" : "xs"}
      height="10"
      maxHeight="10"
      position="relative"
      overflow={isActive ? "visible" : "hidden"}
      background="bg"
      textAlign={column.alignment ?? "left"}
      textStyle="paragraph/S/regular"
      textOverflow="ellipsis"
      verticalAlign="middle"
      whiteSpace="nowrap"
      borderRightWidth="1px"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      cursor={isEditable && !isActive ? "text" : undefined}
      tabIndex={isEditable && !isActive ? 0 : undefined}
      onClick={isEditable && !isActive ? onActivate : undefined}
      onKeyDown={handleKeyDown}
    >
      {content}
    </Table.Cell>
  );
};
