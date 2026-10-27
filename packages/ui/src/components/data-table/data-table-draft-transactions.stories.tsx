import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataTable } from "./data-table";
import type { DataTableEditModeColumn, DataTableEditTarget, RowData } from "./types";

const DraftTransactionsScene = () => {
  const [data, setData] = useState<RowData[]>([
    { id: "edited", name: "left" },
    { id: "other", name: "keep" },
  ]);
  const [columns, setColumns] = useState<DataTableEditModeColumn[]>([{ id: "name", label: "Name", alignment: null }]);
  const [counts, setCounts] = useState({ opened: 0, disposed: 0 });
  const createDraft = (target: DataTableEditTarget) => {
    setCounts((current) => ({ ...current, opened: current.opened + 1 }));
    return {
      commit(value: string) {
        if (target.kind === "cell")
          setData((current) =>
            current.map((row) => (row.id === target.rowId ? { ...row, [target.columnId]: value } : row)),
          );
        else
          setColumns((current) =>
            current.map((column) => (column.id === target.columnId ? { ...column, label: value } : column)),
          );
      },
      dispose() {
        setCounts((current) => ({ ...current, disposed: current.disposed + 1 }));
      },
    };
  };
  return (
    <Stack gap="md">
      <Button
        size="xs"
        alignSelf="start"
        onClick={() => setData((current) => current.filter((row) => row.id !== "edited"))}
      >
        Remove edited row
      </Button>
      <Text data-testid="draft-transactions" textStyle="label/S/regular">
        {counts.opened} opened, {counts.disposed} disposed
      </Text>
      <DataTable
        data={data}
        isReadOnly={false}
        getRowId={(row) => String(row.id)}
        editMode={{ columns, onColumnsChange: setColumns, onDataChange: setData, createDraft }}
      />
    </Stack>
  );
};

const meta = {
  title: "Components/Data Display/DataTable/Draft Transactions",
  component: DataTable,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DataTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RemovedTarget: Story = {
  render: () => <DraftTransactionsScene />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("cell", { name: "left", exact: true }));
    await expect(canvas.getByTestId("draft-transactions")).toHaveTextContent("1 opened, 0 disposed");
    await userEvent.click(canvas.getByRole("button", { name: "Remove edited row" }));
    await waitFor(() => expect(canvas.getByTestId("draft-transactions")).toHaveTextContent("1 opened, 1 disposed"));
  },
};
