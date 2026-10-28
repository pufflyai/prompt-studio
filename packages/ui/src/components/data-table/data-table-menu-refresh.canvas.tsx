import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataTable } from "./data-table";

const RefreshingRowMenu = () => {
  const [refreshed, setRefreshed] = useState(false);
  const [selection, setSelection] = useState("");
  const name = refreshed ? "Updated workspace" : "Workspace";
  return (
    <Box
      p="md"
      onClickCapture={(event) => {
        if ((event.target as Element).closest('button[aria-label="Row actions"]')) setRefreshed(true);
      }}
    >
      <DataTable
        data={[{ id: "workspace", Name: name }]}
        hiddenColumns={["id"]}
        getRowId={(row) => String(row.id)}
        rowActions={[{ label: "Open terminal", onSelect: (row) => setSelection(String(row.Name)) }]}
      />
      <Text role="status">{selection}</Text>
    </Box>
  );
};

export default {
  title: "Components/Data Display/Data Table/Menu refresh",
  component: RefreshingRowMenu,
  tags: ["!manifest"],
} satisfies Meta<typeof RefreshingRowMenu>;

export const KeepsOpenDuringRefresh: StoryObj<typeof RefreshingRowMenu> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Row actions" }));
    await expect(canvas.getByText("Updated workspace")).toBeVisible();
    const action = await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Open terminal" });
    await waitFor(() => expect(action).toBeVisible());
    await userEvent.click(action);
    await expect(canvas.getByRole("status")).toHaveTextContent("Updated workspace");
  },
};
