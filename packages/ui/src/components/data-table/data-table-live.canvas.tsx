import { Box, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { DataTable } from "./data-table";

const LiveRowActions = () => {
  const [revision, setRevision] = useState(0);
  const [openedRevision, setOpenedRevision] = useState<number>();
  useEffect(() => {
    const refresh = setInterval(() => setRevision((value) => value + 1), 1000);
    return () => clearInterval(refresh);
  }, []);
  return (
    <Box height="full" padding="md">
      <Text data-testid="data-revision">Latest revision: {revision}</Text>
      <Text data-testid="opened-revision">Opened revision: {openedRevision ?? "None"}</Text>
      <DataTable
        data={[{ id: "invoice", Invoice: "INV-001", Revision: revision }]}
        hiddenColumns={["id"]}
        selectionMode="multiple"
        getRowId={(row) => String(row.id)}
        getRowActions={() => [{ label: "Open invoice", onSelect: (row) => setOpenedRevision(Number(row.Revision)) }]}
        toolbarStorageKey="storybook-live-row-actions"
      />
    </Box>
  );
};
export default { title: "Components/Data Display/Data Table/Live updates", component: LiveRowActions };
export const RowActionsDuringRefresh = {
  id: "components-data-display-data-table-live-updates--row-actions-during-refresh",
  tags: ["!manifest"],
  render: () => <LiveRowActions />,
};
const StatisticsRowActivation = () => {
  const [opened, setOpened] = useState(false);
  return (
    <Box height="full" padding="md">
      <Text>{opened ? "Opened invoice" : "Select an invoice"}</Text>
      <DataTable
        data={Array.from({ length: 5 }, (_, index) => ({ Invoice: `INV-00${index + 1}`, Amount: index + 1 }))}
        columnStats={{ Invoice: { type: "top-values", limit: 5 }, Amount: { type: "histogram" } }}
        defaultSettings={{ showStats: true }}
        onRowClick={() => setOpened(true)}
        toolbarStorageKey="storybook-statistics-row-activation"
      />
    </Box>
  );
};
export const RowActivationWithStatistics = {
  id: "components-data-display-data-table-live-updates--row-activation-with-statistics",
  tags: ["!manifest"],
  render: () => <StatisticsRowActivation />,
};
