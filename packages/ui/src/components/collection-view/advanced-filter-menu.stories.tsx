import { Box } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AdvancedFilterMenu } from "./advanced-filter-menu";
import { storyFields, storyFilter, storyOptions } from "./collection-view-story-fixtures";

const meta: Meta<typeof AdvancedFilterMenu> = {
  title: "Patterns/Collection View/Advanced Filter Menu",
  component: AdvancedFilterMenu,
};

export default meta;

type Story = StoryObj;

const Menu = (props: { filter: ViewFilterGroup }) => {
  const [filter, setFilter] = useState(props.filter);
  return (
    <Box width="40rem" padding="2xs" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg">
      <AdvancedFilterMenu fields={storyFields} filter={filter} optionsFor={storyOptions} onChange={setFilter} />
    </Box>
  );
};

export const SimpleRules: Story = {
  render: () => (
    <Menu
      filter={{
        conjunction: "and",
        rules: [
          { attributeId: "title", condition: "contains", value: "chat" },
          { attributeId: "score", condition: "gte", value: 70 },
        ],
      }}
    />
  ),
};

/** Every rule uses the same And/Or choice. */
export const AllOrAnyRules: Story = {
  render: () => <Menu filter={storyFilter} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Conjunction" }));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Or", exact: true }));
    await expect(canvas.getByRole("button", { name: "Conjunction" })).toHaveTextContent("Or");
    await userEvent.click(canvas.getAllByRole("button", { name: "Remove filter" })[0]!);
    await expect(canvas.getAllByTestId("filter-rule-row")).toHaveLength(3);
  },
};

/** "Is empty" and "Is not empty" take no value, so the value control is hidden. */
export const EmptyValueConditions: Story = {
  render: () => (
    <Menu
      filter={{
        conjunction: "or",
        rules: [
          { attributeId: "assignee", condition: "is-empty" },
          { attributeId: "labels", condition: "is-not-empty" },
        ],
      }}
    />
  ),
};
