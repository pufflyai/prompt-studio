import { Flex, Icon, IconButton, Table, Text } from "@chakra-ui/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { EditModeHeaderEditor } from "./edit-mode-data-table-editors";
import { getIcon } from "./helpers";
import type { DataTableEditModeColumn, DataTableEditModeConfig, RowData } from "./types";

interface ActiveHeader {
  columnId: string;
  draft: string;
}

interface EditModeDataTableHeaderProps {
  activeHeader: ActiveHeader | null;
  columnIcons?: Record<string, ReactNode>;
  columns: DataTableEditModeColumn[];
  data: RowData[];
  editMode: DataTableEditModeConfig;
  isReadOnly: boolean;
  selectionHeader?: ReactNode;
  onAddColumn: () => void;
  onCancelHeaderEdit: () => void;
  onDeleteColumn: (columnId: string) => void;
  onHeaderDraftChange: (draft: string) => void;
  onHeaderEdit: (column: DataTableEditModeColumn) => void;
  onSaveHeader: () => void;
}

export const EditModeDataTableHeader = (props: EditModeDataTableHeaderProps) => {
  const {
    activeHeader,
    columnIcons,
    columns,
    data,
    editMode,
    isReadOnly,
    selectionHeader,
    onAddColumn,
    onCancelHeaderEdit,
    onDeleteColumn,
    onHeaderDraftChange,
    onHeaderEdit,
    onSaveHeader,
  } = props;

  return (
    <Table.Header>
      <Table.Row height="10" background="bg.subtle">
        <Table.ColumnHeader
          data-column-id="rowIndex"
          width="fit-content"
          padding="xs"
          background="bg.subtle"
          borderRightWidth="1px"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        />
        {selectionHeader ? (
          <Table.ColumnHeader
            data-column-id="rowSelection"
            padding="xs"
            textAlign="center"
            background="bg.subtle"
            borderRightWidth="1px"
            borderBottomWidth="1px"
            borderColor="border.subtle"
          >
            {selectionHeader}
          </Table.ColumnHeader>
        ) : null}
        {columns.map((column) => {
          const isEditing = activeHeader?.columnId === column.id;
          const headerIcon = columnIcons?.[column.id] ?? getIcon(data.map((row) => row[column.id]));
          const header = (
            <Table.ColumnHeader
              key={column.id}
              data-column-id={column.id}
              data-data-column="true"
              height="10"
              padding={isEditing ? "0" : "xs"}
              position="relative"
              overflow="hidden"
              background="bg.subtle"
              textAlign={column.alignment ?? "left"}
              borderRightWidth="1px"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              cursor={isReadOnly ? "default" : "context-menu"}
            >
              {isEditing ? (
                <EditModeHeaderEditor
                  accessibleName={column.label || "empty"}
                  draft={activeHeader.draft}
                  onChange={onHeaderDraftChange}
                  onSave={onSaveHeader}
                  onCancel={onCancelHeaderEdit}
                />
              ) : (
                <Flex alignItems="center" gap="1" minWidth="0" overflow="hidden">
                  {headerIcon}
                  <Text as="div" textStyle="label/S/medium" truncate>
                    {editMode.renderHeader?.(column) ?? column.label}
                  </Text>
                </Flex>
              )}
            </Table.ColumnHeader>
          );

          if (isReadOnly) return header;

          return (
            <ResourceContextMenu
              key={column.id}
              contentMinWidth="12rem"
              actions={[
                {
                  key: "edit-header",
                  label: "Rename column",
                  icon: <Icon as={Pencil} boxSize="14px" />,
                  onClick: () => onHeaderEdit(column),
                },
                {
                  key: "delete-column",
                  label: "Delete column",
                  icon: <Icon as={Trash2} boxSize="14px" />,
                  isDisabled: columns.length === 1,
                  separatorBefore: true,
                  onClick: () => onDeleteColumn(column.id),
                },
              ]}
            >
              {header}
            </ResourceContextMenu>
          );
        })}
        {!isReadOnly ? (
          <Table.ColumnHeader
            data-column-id="editControl"
            width="min-content"
            padding="2xs"
            textAlign="center"
            position="sticky"
            right="0"
            zIndex="3"
            background="bg.subtle"
            borderLeftWidth="1px"
            borderBottomWidth="1px"
            borderColor="border.subtle"
          >
            <IconButton size="xs" variant="ghost" aria-label="Insert column" onClick={onAddColumn}>
              <Plus />
            </IconButton>
          </Table.ColumnHeader>
        ) : null}
      </Table.Row>
    </Table.Header>
  );
};
