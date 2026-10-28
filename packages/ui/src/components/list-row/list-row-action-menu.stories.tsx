import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Archive } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { ListRow } from "./list-row";

const meta: Meta<typeof ListRow> = {
  title: "Components/Data Display/List Row/Action Menus",
  component: ListRow,
};
export default meta;
type Story = StoryObj<typeof ListRow>;

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

const checkDisabled: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole("button", { name: "Resource actions" }));
  const archive = await body.findByRole("menuitem", { name: "Archive", exact: true });
  await expect(archive).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(archive);
  await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Invoked: 0"));
};

export const DisabledResourceAction: Story = { render: () => <ActionMenu />, play: checkDisabled };
export const DisabledSearchableAction: Story = {
  render: () => <ActionMenu searchable />,
  play: checkDisabled,
};
