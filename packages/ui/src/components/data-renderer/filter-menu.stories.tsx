import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { FilterCategoryView } from "./data-renderer-helpers";
import { omitFilterCategory } from "./data-renderer-helpers";
import { FilterMenu } from "./filter-menu";
import type { DataRendererFilterState } from "./types";

const categories: FilterCategoryView[] = [
  {
    id: "status",
    label: "Status",
    selectionMode: "multiple",
    options: [
      { value: "todo", label: "Todo" },
      { value: "in_progress", label: "In Progress" },
      { value: "done", label: "Done" },
    ],
  },
  {
    id: "priority",
    label: "Priority",
    selectionMode: "multiple",
    options: [
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
  },
];

const singleSelectCategories: FilterCategoryView[] = [
  {
    id: "status",
    label: "Status",
    selectionMode: "single",
    options: [
      { value: "todo", label: "Todo" },
      { value: "in_progress", label: "In Progress" },
      { value: "done", label: "Done" },
    ],
  },
];

const countsByCategory = {
  status: { todo: 4, in_progress: 2, done: 1 },
  priority: { high: 3, medium: 2, low: 1 },
};

const meta: Meta = {
  title: "Patterns/Data Renderer/Filter Menu",
};

export default meta;

type Story = StoryObj;

const Wrapper = (props: { initialFilters?: DataRendererFilterState; categories?: FilterCategoryView[] } = {}) => {
  const [filters, setFilters] = useState<DataRendererFilterState>(props.initialFilters ?? {});
  const categoriesToRender = props.categories ?? categories;

  return (
    <Box p="lg">
      <FilterMenu
        categories={categoriesToRender}
        filters={filters}
        countsByCategory={countsByCategory}
        onReplaceFilterValue={(category, value) => setFilters((current) => ({ ...current, [category]: [value] }))}
        onToggleFilterValue={(category, value) => {
          setFilters((current) => {
            const values = current[category] ?? [];
            const nextValues = values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
            return nextValues.length === 0
              ? omitFilterCategory(current, category)
              : { ...current, [category]: nextValues };
          });
        }}
        onClearFilter={(category) => setFilters((current) => omitFilterCategory(current, category))}
        onClearAll={() => setFilters({})}
      />
      <Text mt="sm" data-testid="filters-value">
        {JSON.stringify(filters)}
      </Text>
    </Box>
  );
};

export const NoFilters: Story = { render: () => <Wrapper /> };

export const SelectedFilters: Story = {
  render: () => <Wrapper initialFilters={{ status: ["todo"], priority: ["high", "medium"] }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Filter rows"));
  },
};

export const SelectFilter: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Filter rows"));
    await userEvent.click(within(document.body).getByRole("checkbox", { name: "Todo" }));
    await expect(canvas.getByTestId("filters-value")).toHaveTextContent('"status":["todo"]');
  },
};

export const RestoredSingleSelectKeepsOneValue: Story = {
  render: () => <Wrapper categories={singleSelectCategories} initialFilters={{ status: ["todo", "done"] }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Filter rows"));

    await expect(within(document.body).getByRole("radio", { name: "Todo" })).toHaveAttribute("aria-checked", "true");
    await expect(within(document.body).getByRole("radio", { name: "Done" })).toHaveAttribute("aria-checked", "false");
  },
};

export const SelectMultipleFilters: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Filter rows"));

    await userEvent.click(within(document.body).getByRole("checkbox", { name: "Todo" }));
    await userEvent.click(within(document.body).getByRole("checkbox", { name: "Done" }));

    await expect(within(document.body).getByRole("checkbox", { name: "Todo" })).toHaveAttribute("aria-checked", "true");
    await expect(within(document.body).getByRole("checkbox", { name: "Done" })).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByTestId("filters-value")).toHaveTextContent('"status":["todo","done"]');
  },
};
