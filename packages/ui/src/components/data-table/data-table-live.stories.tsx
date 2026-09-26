import { Box, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DataTable } from "./data-table";

const LiveRowActions = () => {
  const [revision, setRevision] = useState(0);
  const [openedRevision, setOpenedRevision] = useState<number>();
  useEffect(() => {
    const refresh = setInterval(() => setRevision((value) => value + 1), 1_000);
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
  tags: ["!manifest"],
  render: () => <LiveRowActions />,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Select row"));
    const trigger = canvas.getByRole("button", { name: "Row actions" });
    await userEvent.click(trigger);
    const revision = canvas.getByTestId("data-revision").textContent;
    await waitFor(() => expect(canvas.getByTestId("data-revision").textContent).not.toBe(revision), { timeout: 2_000 });
    await expect(within(canvas.getByLabelText("Select row")).getByRole("checkbox")).toBeChecked();
    const action = within(document.body).getByRole("menuitem", { name: "Open invoice" });
    await expect(action).toBeVisible();
    await userEvent.click(action);
    const openedRevision = Number(canvas.getByTestId("opened-revision").textContent?.split(": ")[1]);
    await expect(openedRevision).toBeGreaterThan(Number(revision?.split(": ")[1]));
  },
};
