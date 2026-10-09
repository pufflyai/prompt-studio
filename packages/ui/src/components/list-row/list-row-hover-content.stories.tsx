import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Computer, Plus } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { PaletteShortcut } from "../command-palette/palette-shortcut";
import { ListRow } from "./list-row";

const meta = {
  title: "Components/Data Display/List Row/Hover Content",
  component: ListRow,
  tags: ["hover-content"],
} satisfies Meta<typeof ListRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const NarrowNavigationExample = () => {
  const [actionCount, setActionCount] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  return (
    <Stack w="48" gap="sm">
      <ListRow
        variant="tree"
        label="Workspaces"
        tooltip="Workspaces"
        icon={<Computer />}
        endContent={<PaletteShortcut binding="Alt+Shift+W" variant="sidenav" />}
        endContentVisibility="hover"
        onActivate={() => setRowCount((count) => count + 1)}
        actions={[
          {
            id: "new-workspace",
            label: "New workspace",
            icon: <Plus />,
            onAction: () => setActionCount((count) => count + 1),
          },
        ]}
      />
      <ListRow
        variant="tree"
        label="Workspaces"
        icon={<Computer />}
        actions={[{ id: "new-workspace", label: "New workspace", icon: <Plus /> }]}
      />
      <ListRow
        variant="tree"
        label="Workspaces"
        icon={<Computer />}
        endContent={<Text textStyle="label/XS">12</Text>}
      />
      <Box color="fg.muted" textStyle="label/XS">
        Hover or focus a row. Hidden shortcuts and actions release label space; the count stays visible.
      </Box>
      <Text role="status" aria-label="Action activations" textStyle="label/XS">
        {actionCount}
      </Text>
      <Text role="status" aria-label="Row activations" textStyle="label/XS">
        {rowCount}
      </Text>
    </Stack>
  );
};

export const NarrowNavigation: Story = {
  render: () => <NarrowNavigationExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getAllByRole("option", { name: "Workspaces", exact: true })[0];
    await userEvent.click(row);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "Action activations" })).toHaveTextContent("1");
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("status", { name: "Action activations" })).toHaveTextContent("2");
    await expect(canvas.getByRole("status", { name: "Row activations" })).toHaveTextContent("1");
    row.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status", { name: "Row activations" })).toHaveTextContent("2");
  },
};
