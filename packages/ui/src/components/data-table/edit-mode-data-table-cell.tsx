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
  wrapRows: boolean;
  onActivate: () => void;
  onCancel: () => void;
  onDraftChange: (draft: string) => void;
  onSave: () => void;
}

const getRowDisplayProps = (wrapRows: boolean) => {
  if (wrapRows) {
    return {
      height: undefined,
      maxHeight: undefined,
      overflowWrap: "anywhere" as const,
      textOverflow: undefined,
      verticalAlign: "top" as const,
      whiteSpace: "normal" as const,
    };
  }

  return {
    height: "10",
    maxHeight: "10",
    overflowWrap: undefined,
    textOverflow: "ellipsis" as const,
    verticalAlign: "middle" as const,
    whiteSpace: "nowrap" as const,
  };
};

export const EditModeDataTableCell = (props: EditModeDataTableCellProps) => {
  const {
    activeDraft = "",
    column,
    context,
    editMode,
    isActive,
    isReadOnly,
    wrapRows,
    onActivate,
    onCancel,
    onDraftChange,
    onSave,
  } = props;
  const cellRef = useRef<HTMLTableCellElement>(null);
  const isEditable = !isReadOnly && (editMode.isCellEditable?.(context) ?? true);
  const rowDisplayProps = getRowDisplayProps(wrapRows);
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
      <Box
        width="100%"
        minHeight="5"
        textAlign="inherit"
        overflowWrap={rowDisplayProps.overflowWrap}
        whiteSpace={rowDisplayProps.whiteSpace}
      >
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
      height={rowDisplayProps.height}
      maxHeight={rowDisplayProps.maxHeight}
      position="relative"
      overflow={isActive ? "visible" : "hidden"}
      background="bg"
      textAlign={column.alignment ?? "left"}
      textStyle="paragraph/S/regular"
      textOverflow={rowDisplayProps.textOverflow}
      verticalAlign={rowDisplayProps.verticalAlign}
      whiteSpace={rowDisplayProps.whiteSpace}
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
