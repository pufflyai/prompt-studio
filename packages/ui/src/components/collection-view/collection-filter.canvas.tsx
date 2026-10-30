import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { CollectionFilter, type CollectionFilterProps } from "./collection-filter";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";

function FilterStory(props: CollectionFilterProps) {
  const { filter: initialFilter, ...rest } = props;
  const [filter, setFilter] = useState(initialFilter);
  return <CollectionFilter {...rest} filter={filter} onFilterChange={setFilter} />;
}
const meta: CanvasMeta<typeof CollectionFilter> = {
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
type Story = CanvasVariant<typeof CollectionFilter>;
export const InlineCriteria: Story = {
  id: "patterns-collection-view-collection-filter--inline-criteria",
};
export const Empty: Story = {
  id: "patterns-collection-view-collection-filter--empty",
  args: { filter: { conjunction: "and", rules: [] } },
};
export const Advanced: Story = {
  id: "patterns-collection-view-collection-filter--advanced",
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
