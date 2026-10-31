import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Archive } from "lucide-react";
import { useState } from "react";
import { ListRow } from "./list-row";

const meta: CanvasMeta<typeof ListRow> = {
  title: "Components/Data Display/List Row/Action Menus",
  component: ListRow,
};
export default meta;
type Story = CanvasFrame<typeof ListRow>;
const ActionMenu = (props: { searchable?: boolean }) => {
  const { searchable } = props;
  const [invoked, setInvoked] = useState(0);
  return (
    <Stack w="80">
      <ListRow
        id="ticket"
        label="Release notes"
        showContextMenuTrigger
        actions={[
          {
            id: "archive",
            label: "Archive",
            icon: <Archive />,
            disabled: true,
            onAction: () => setInvoked(invoked + 1),
          },
        ]}
        contextMenuItems={Array.from({ length: searchable ? 7 : 1 }, (_, index) => ({
          id: `action-${index}`,
          label: `Action ${index + 1}`,
        }))}
      />
      <Text role="status" textStyle="label/XS">
        Invoked: {invoked}
      </Text>
    </Stack>
  );
};
export const DisabledResourceAction: Story = {
  id: "components-data-display-list-row-action-menus--disabled-resource-action",
  render: () => <ActionMenu />,
};
export const DisabledSearchableAction: Story = {
  id: "components-data-display-list-row-action-menus--disabled-searchable-action",
  render: () => <ActionMenu searchable />,
};
