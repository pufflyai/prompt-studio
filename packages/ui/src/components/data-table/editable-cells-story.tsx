import { Box, Button, Icon as ChakraIcon, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { DataTable, type DataTableProps } from ".";
import { generateTableRows } from "./data-table.story-fixtures";

interface EditableCellsStoryProps {
  args: DataTableProps;
  height?: string;
  marginX?: string;
  maxWidth?: string;
}

export const EditableCellsStory = (props: EditableCellsStoryProps) => {
  const { args, maxWidth, height, marginX } = props;
  const [rows, setRows] = useState(() => generateTableRows(18));
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    value: string;
  } | null>(null);
  const editableColumns = new Set(["Vendor", "Amount", "Region", "Department", "Priority"]);

  const handleSave = () => {
    if (!editingCell) return;

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== editingCell.rowId) return row;
        const nextValue = editingCell.columnId === "Amount" ? Number(editingCell.value) : editingCell.value;
        return { ...row, [editingCell.columnId]: nextValue };
      }),
    );
    setEditingCell(null);
  };

  return (
    <Stack width="100%" maxWidth={maxWidth} height={height} marginX={marginX} gap="xs">
      <Box flex="1" minH="0">
        <DataTable
          {...args}
          data={rows}
          getCellContextMenuActions={(context) => {
            if (!editableColumns.has(context.columnId)) return [];

            return [
              {
                label: "Edit cell",
                icon: <ChakraIcon as={Pencil} boxSize="16px" />,
                onSelect: () =>
                  setEditingCell({
                    rowId: context.rowId,
                    columnId: context.columnId,
                    value: String(context.value ?? ""),
                  }),
              },
            ];
          }}
        />
      </Box>
      {editingCell ? (
        <HStack gap="xs" borderWidth="1px" borderColor="border.subtle" padding="xs" borderRadius="xs">
          <Text textStyle="label/S/medium" color="fg.muted">
            {editingCell.columnId}
          </Text>
          <Input
            size="sm"
            value={editingCell.value}
            onChange={(event) => setEditingCell({ ...editingCell, value: event.target.value })}
          />
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)}>
            Cancel
          </Button>
        </HStack>
      ) : null}
    </Stack>
  );
};
