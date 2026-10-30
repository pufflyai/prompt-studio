import { Box, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Computer, Plus } from "lucide-react";
import { useState } from "react";
import { ListRow } from "./list-row";

const meta = {
  title: "Components/Data Display/List Row/Hover Content",
  component: ListRow,
} satisfies CanvasMeta<typeof ListRow>;
export default meta;
type Story = CanvasVariant<typeof meta>;
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
        Hover or focus a row. Hidden actions release label space; the count stays visible.
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
  id: "components-data-display-list-row-hover-content--narrow-navigation",
  render: () => <NarrowNavigationExample />,
};
