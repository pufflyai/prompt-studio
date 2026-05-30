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
    options: [
      { value: "todo", label: "Todo" },
      { value: "in_progress", label: "In Progress" },
      { value: "done", label: "Done" },
    ],
  },
];

const countsByCategory = {
  status: { todo: 4, in_progress: 2, done: 1 },
};

const meta: Meta = {
  title: "Patterns/Data Renderer/Filter Menu",
};

export default meta;

type Story = StoryObj;

const Wrapper = () => {
  const [filters, setFilters] = useState<DataRendererFilterState>({});

  return (
    <Box p="lg">
      <FilterMenu
        categories={categories}
        filters={filters}
        countsByCategory={countsByCategory}
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

export const SelectFilter: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Filter rows"));
    await userEvent.click(within(document.body).getByRole("checkbox", { name: "Todo" }));
    await expect(canvas.getByTestId("filters-value")).toHaveTextContent('"status":["todo"]');
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
