import { Box, Text } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { storyFields, storyOptions } from "./collection-view-story-fixtures";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";
import { FilterMenu } from "./filter-menu";

const meta: Meta<typeof FilterMenu> = {
  title: "Patterns/Collection View/Filter Menu",
  component: FilterMenu,
};

export default meta;

type Story = StoryObj;

const Picker = (props: { filter?: ViewFilterGroup }) => {
  const [filter, setFilter] = useState(props.filter ?? EMPTY_VIEW_FILTER);
  const [picked, setPicked] = useState<string>();
  return (
    <Box width="440px" borderWidth="1px" borderColor="border" borderRadius="md" bg="bg" padding="2xs">
      <FilterMenu
        fields={storyFields}
        filter={filter}
        optionsFor={storyOptions}
        onChange={setFilter}
        onPickField={(field) => setPicked(field.id)}
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
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("checkbox", { name: "In progress" }));
    await expect(canvas.getByTestId("filter-value")).toHaveTextContent('"condition":"is-any-of"');
  },
};

/** Fields without options open the rule editor for a new rule. */
export const TextField: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Title/ }));
    await expect(canvas.getByTestId("picked-field")).toHaveTextContent("title");
  },
};

export const WithSelectedValues: Story = {
  render: () => (
    <Picker
      filter={{
        conjunction: "and",
        rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo", "done"] }],
      }}
    />
  ),
};
