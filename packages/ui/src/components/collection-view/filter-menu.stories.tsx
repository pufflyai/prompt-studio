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
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("checkbox", { name: "In progress" });
    const label = within(option).getByText("In progress").getBoundingClientRect();
    const checkbox = option.querySelector("[data-part=control]")!.getBoundingClientRect();
    expect(checkbox.left).toBeGreaterThan(label.right);
    await userEvent.click(option);
    await expect(canvas.getByTestId("filter-value")).toHaveTextContent('"condition":"is-any-of"');
    expect(checkbox.width).toBe(12);
  },
};

/** Fields without options open the rule editor for a new rule. */
export const TextField: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Title/ }));
    await expect(canvas.getByTestId("filter-value")).toHaveTextContent("[]");
    await userEvent.click(canvas.getByRole("button", { name: "Apply filter", exact: true }));
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
  play: async ({ canvasElement }) => {
    const picker = within(canvasElement).getByTestId("filter-menu");
    const viewportHeight = canvasElement.ownerDocument.defaultView!.innerHeight;
    expect(picker.getBoundingClientRect().height).toBe(Math.min(480, viewportHeight - 32));
  },
};

export const SearchPropertyScope: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Priority", exact: true }));
    await expect(canvas.getByRole("checkbox", { name: "High", exact: true })).toBeVisible();
    const search = canvas.getByRole("textbox", { name: "Filter properties" });
    await userEvent.type(search, "title");
    expect(canvas.queryByRole("checkbox", { name: "High", exact: true })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Title", exact: true }));
    const row = canvas.getByRole("button", { name: "Apply filter", exact: true });
    const column = row.closest('[data-testid="filter-value-column"]')!;
    expect(row.getBoundingClientRect().width).toBe(column.clientWidth - 24);
    expect(row.getBoundingClientRect().height).toBe(32);
    await userEvent.clear(search);
    await expect(canvas.getByRole("button", { name: "Apply filter", exact: true })).toBeVisible();
  },
};

export const ValuePanelLabels: Story = {
  render: () => <Picker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const field of ["Archived", "Labels", "Priority"]) {
      await userEvent.click(canvas.getByRole("button", { name: field, exact: true }));
      const panel = canvas.getByTestId("filter-value-column");
      const label = within(panel).getByText("Value", { exact: true });
      await expect(label).toBeVisible();
      if (field === "Archived") {
        for (const value of ["Yes", "No"])
          await expect(
            within(canvas.getByRole("button", { name: value, exact: true })).getByRole("checkbox", { hidden: true }),
          ).not.toBeChecked();
      }
      expect(label.getBoundingClientRect().left - panel.getBoundingClientRect().left).toBe(12);
    }
  },
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
  render: () => <LongPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByTestId("filter-value-column");
    const viewport = panel.querySelector('[data-part="viewport"]')!;
    expect(viewport.getBoundingClientRect().bottom).toBe(panel.getBoundingClientRect().bottom - 12);
    viewport.scrollTop = viewport.scrollHeight;
    const last = canvas.getByRole("checkbox", { name: "Option 29", exact: true });
    await expect(last).toBeVisible();
    expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(panel.getBoundingClientRect().bottom);
    await userEvent.click(last);
    await expect(last).toHaveAttribute("aria-checked", "true");
  },
};

export const MatchCounts: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todo = canvas.getByRole("checkbox", { name: "Todo", exact: true });
    const progress = canvas.getByRole("checkbox", { name: "In progress", exact: true });
    await expect(within(progress).getByText("5", { exact: true })).toBeVisible();
    expect(within(todo).queryByText("0", { exact: true })).toBeNull();
  },
};

export const BooleanSelection: Story = {
  render: () => (
    <Picker filter={{ conjunction: "and", rules: [{ attributeId: "archived", condition: "is-not", value: true }] }} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Archived", exact: true }));
    const no = canvas.getByRole("button", { name: "No", exact: true });
    const yes = canvas.getByRole("button", { name: "Yes", exact: true });
    await expect(within(no).getByRole("checkbox", { hidden: true })).toBeChecked();
    await expect(within(yes).getByRole("checkbox", { hidden: true })).not.toBeChecked();
    await userEvent.click(yes);
    await expect(within(yes).getByRole("checkbox", { hidden: true })).toBeChecked();
    await expect(within(no).getByRole("checkbox", { hidden: true })).not.toBeChecked();
  },
};
