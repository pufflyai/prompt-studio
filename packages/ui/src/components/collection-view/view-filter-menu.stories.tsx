import { Box } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { storyFields, storyFilter, storyOptions } from "./collection-view-story-fixtures";
import { ViewFilterMenu } from "./view-filter-menu";

const meta: Meta<typeof ViewFilterMenu> = {
  title: "Patterns/Collection View/View Filter Menu",
  component: ViewFilterMenu,
};

export default meta;

type Story = StoryObj;

const Menu = (props: { filter: ViewFilterGroup }) => {
  const [filter, setFilter] = useState(props.filter);
  return (
    <Box width="40rem" padding="2xs" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg">
      <ViewFilterMenu fields={storyFields} filter={filter} optionsFor={storyOptions} onChange={setFilter} />
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

/** "A and (B or C)": the root joins with And and the nested group joins with Or. */
export const OrGroup: Story = {
  render: () => <Menu filter={storyFilter} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("filter-rule-group")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Add filter group" }));
    await expect(canvas.getAllByTestId("filter-rule-group")).toHaveLength(2);
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
