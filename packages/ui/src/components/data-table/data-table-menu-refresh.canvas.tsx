import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
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
} satisfies CanvasMeta<typeof RefreshingRowMenu>;
export const KeepsOpenDuringRefresh: CanvasVariant<typeof RefreshingRowMenu> = {
  id: "components-data-display-data-table-menu-refresh--keeps-open-during-refresh",
};
