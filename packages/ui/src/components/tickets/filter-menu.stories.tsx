import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { FilterMenu } from "./filter-menu";
import type { FilterState, WorkspaceFilterCategory } from "./types";

const categories: WorkspaceFilterCategory[] = [
  {
    id: "status",
    label: "Status",
    options: [
      { value: "todo", label: "Todo" },
      { value: "in_progress", label: "In Progress" },
      { value: "done", label: "Done" },
    ],
  },
  {
    id: "priority",
    label: "Priority",
    options: [
      { value: "p1", label: "P1" },
      { value: "p2", label: "P2" },
    ],
  },
];

const countsByCategory = {
  status: { todo: 4, in_progress: 2, done: 1 },
  priority: { p1: 3, p2: 4 },
};

const meta: Meta = {
  title: "Tickets/FilterMenu",
};

export default meta;

type Story = StoryObj;

const Wrapper = () => {
  const [filters, setFilters] = useState<FilterState>({});

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
            const next = { ...current, [category]: nextValues };

            if (nextValues.length === 0) {
              delete next[category];
            }

            return next;
          });
        }}
        onClearFilter={(category) => {
          setFilters((current) => {
            const next = { ...current };
            delete next[category];
            return next;
          });
        }}
        onClearAll={() => setFilters({})}
      />
      <Text mt="sm" data-testid="filters-value">
        {JSON.stringify(filters)}
      </Text>
    </Box>
  );
};

export const NoFilters: Story = {
  render: () => <Wrapper />,
};

export const SelectFilter: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Filter tickets"));
    await userEvent.click(within(document.body).getByText("Todo"));
    await expect(canvas.getByTestId("filters-value")).toHaveTextContent('"status":["todo"]');
  },
};
