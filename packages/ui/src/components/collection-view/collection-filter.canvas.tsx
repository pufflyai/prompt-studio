import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { CollectionFilter, type CollectionFilterProps } from "./collection-filter";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";

function FilterStory(props: CollectionFilterProps) {
  const { filter: initialFilter, ...rest } = props;
  const [filter, setFilter] = useState(initialFilter);
  return <CollectionFilter {...rest} filter={filter} onFilterChange={setFilter} />;
}

const meta: Meta<typeof CollectionFilter> = {
  title: "Patterns/Collection View/Collection Filter",
  component: CollectionFilter,
  render: (props) => <FilterStory {...props} />,
  args: {
    itemLabel: "Ticket",
    fields: storyFields,
    optionsFor: storyOptions,
    onFilterChange: () => {},
    filter: {
      conjunction: "and",
      rules: [{ attributeId: "status", condition: "is-any-of", value: ["backlog", "done"] }],
    },
  },
};
export default meta;
type Story = StoryObj<typeof CollectionFilter>;

export const InlineCriteria: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    await expect(await body.findByTestId("filter-menu")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    await expect(body.queryByTestId("filter-menu")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Remove Status filter" }));
    await expect(canvas.queryByRole("group", { name: "Status filter" })).not.toBeInTheDocument();
  },
};
export const Empty: Story = { args: { filter: { conjunction: "and", rules: [] } } };
export const Advanced: Story = {
  args: {
    filter: {
      conjunction: "and",
      rules: [],
      groups: [
        {
          conjunction: "or",
          rules: [
            { attributeId: "status", condition: "is-any-of", value: ["done"] },
            { attributeId: "priority", condition: "is-any-of", value: ["low"] },
          ],
        },
      ],
    },
  },
};
