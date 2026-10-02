import { Box } from "@chakra-ui/react";
import type { ViewSort } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { canSortField } from "./collection-view-fields";
import { storyFields } from "./collection-view-story-fixtures";
import { ViewSortMenu } from "./view-sort-menu";

const meta: Meta<typeof ViewSortMenu> = {
  title: "Patterns/Collection View/View Sort Menu",
  component: ViewSortMenu,
};

export default meta;

type Story = StoryObj;

const Menu = (props: { sorts: ViewSort[] }) => {
  const [sorts, setSorts] = useState(props.sorts);
  return (
    <Box width="25rem" padding="2xs" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg">
      <ViewSortMenu fields={storyFields.filter(canSortField)} sorts={sorts} onChange={setSorts} />
    </Box>
  );
};

export const OneLevel: Story = {
  render: () => <Menu sorts={[{ attributeId: "priority", direction: "asc" }]} />,
};

/** The top row sorts first; ties fall to the next row. Direction labels follow the field type. */
export const TwoLevels: Story = {
  render: () => (
    <Menu
      sorts={[
        { attributeId: "priority", direction: "asc" },
        { attributeId: "updated", direction: "desc" },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByTestId("sort-rule-row")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "Add sort" }));
    await expect(canvas.getAllByTestId("sort-rule-row")).toHaveLength(3);
  },
};

/** Drag a row by its grip to change which sort decides first. */
export const Reorder: Story = {
  render: () => (
    <Menu
      sorts={[
        { attributeId: "title", direction: "asc" },
        { attributeId: "score", direction: "desc" },
        { attributeId: "updated", direction: "asc" },
      ]}
    />
  ),
};
