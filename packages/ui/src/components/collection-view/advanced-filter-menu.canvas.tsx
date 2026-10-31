import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { AdvancedFilterMenu } from "./advanced-filter-menu";
import { storyFields, storyFilter, storyOptions } from "./collection-view-story-fixtures";

const meta: CanvasMeta<typeof AdvancedFilterMenu> = {
  title: "Patterns/Collection View/Advanced Filter Menu",
  component: AdvancedFilterMenu,
};
export default meta;
type Story = CanvasFrame;
const Menu = (props: { filter: ViewFilterGroup }) => {
  const [filter, setFilter] = useState(props.filter);
  return (
    <Box width="40rem" padding="2xs" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg">
      <AdvancedFilterMenu fields={storyFields} filter={filter} optionsFor={storyOptions} onChange={setFilter} />
    </Box>
  );
};
export const SimpleRules: Story = {
  id: "patterns-collection-view-advanced-filter-menu--simple-rules",
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
  id: "patterns-collection-view-advanced-filter-menu--all-or-any-rules",
  render: () => <Menu filter={storyFilter} />,
};
/** "Is empty" and "Is not empty" take no value, so the value control is hidden. */
export const EmptyValueConditions: Story = {
  id: "patterns-collection-view-advanced-filter-menu--empty-value-conditions",
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
