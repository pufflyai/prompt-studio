import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";
import { FilterMenu } from "./filter-menu";

const meta: CanvasMeta<typeof FilterMenu> = {
  title: "Patterns/Collection View/Filter Menu",
  component: FilterMenu,
};
export default meta;
type Story = CanvasVariant;
const Picker = (props: { filter?: ViewFilterGroup }) => {
  const [filter, setFilter] = useState(props.filter ?? EMPTY_VIEW_FILTER);
  const [picked, setPicked] = useState<string>();
  return (
    <Box width="440px" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg" padding="2xs">
      <FilterMenu
        fields={storyFields}
        filter={filter}
        optionsFor={storyOptions}
        onSelectRule={(rule) => {
          setFilter({ ...filter, rules: [rule] });
          setPicked(rule.attributeId);
        }}
      />
      <Text data-testid="filter-value" textStyle="label/XS" padding="xs">
        {JSON.stringify(filter.rules)}
      </Text>
      <Text data-testid="picked-field" textStyle="label/XS" padding="xs">
        {picked}
      </Text>
    </Box>
  );
};
/** Option fields add an "is any of" rule from the value list. */
export const OptionValues: Story = {
  id: "patterns-collection-view-filter-menu--option-values",
  render: () => <Picker />,
};
/** Fields without options open the rule editor for a new rule. */
export const TextField: Story = {
  id: "patterns-collection-view-filter-menu--text-field",
  render: () => <Picker />,
};
export const WithSelectedValues: Story = {
  id: "patterns-collection-view-filter-menu--with-selected-values",
  render: () => (
    <Picker
      filter={{
        conjunction: "and",
        rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo", "done"] }],
      }}
    />
  ),
};
export const SearchPropertyScope: Story = {
  id: "patterns-collection-view-filter-menu--search-property-scope",
  render: () => <Picker />,
};
export const ValuePanelLabels: Story = {
  id: "patterns-collection-view-filter-menu--value-panel-labels",
  render: () => <Picker />,
};
const LongPicker = () => {
  const [filter, setFilter] = useState(EMPTY_VIEW_FILTER);
  return (
    <Box width="440px">
      <FilterMenu
        fields={storyFields}
        filter={filter}
        optionsFor={() =>
          Array.from({ length: 30 }, (_, index) => ({ value: String(index), label: `Option ${index}` }))
        }
        onSelectRule={(rule) => setFilter({ ...filter, rules: [rule] })}
        onAddAdvanced={() => undefined}
        onClear={() => setFilter(EMPTY_VIEW_FILTER)}
      />
    </Box>
  );
};
export const LongValueList: Story = {
  id: "patterns-collection-view-filter-menu--long-value-list",
  render: () => <LongPicker />,
};
export const MatchCounts: Story = {
  id: "patterns-collection-view-filter-menu--match-counts",
  render: () => (
    <Box width="440px">
      <FilterMenu
        fields={storyFields}
        filter={EMPTY_VIEW_FILTER}
        optionsFor={(field) => storyOptions(field).map((option, index) => ({ ...option, count: index === 0 ? 0 : 5 }))}
        onSelectRule={() => undefined}
      />
    </Box>
  ),
};
export const BooleanSelection: Story = {
  id: "patterns-collection-view-filter-menu--boolean-selection",
  render: () => (
    <Picker filter={{ conjunction: "and", rules: [{ attributeId: "archived", condition: "is-not", value: true }] }} />
  ),
};
