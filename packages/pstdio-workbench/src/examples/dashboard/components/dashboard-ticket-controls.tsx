import { HStack } from "@chakra-ui/react";
import {
  DisplayMenu,
  type DisplayProperty,
  type FilterCategory,
  FilterMenu,
  type FilterState,
  type GroupingField,
  type OrderingField,
  useTicketsWorkspaceStore,
  type WorkspaceFilterCategory,
  type WorkspaceOption,
} from "@pstdio/ui";
import {
  dashboardStatusColumns,
  dashboardTickets,
  dashboardTicketsWorkspaceStorageKey,
  dashboardTicketTags,
} from "../mock-data/data";

type DashboardTicket = (typeof dashboardTickets)[number];

const defaultGroupingOptions: WorkspaceOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "No grouping" },
];

const defaultOrderingOptions: WorkspaceOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
  { value: "ticketId", label: "ID" },
];

const defaultDisplayPropertyOptions: WorkspaceOption<DisplayProperty>[] = [
  { value: "id", label: "ID" },
  { value: "status", label: "Status" },
  { value: "updated", label: "Updated" },
];

const toTagKey = (name: string) => `tag:${name}` as const;

const buildGroupingOptions = (): WorkspaceOption<GroupingField>[] => [
  ...defaultGroupingOptions,
  ...dashboardTicketTags.map((tag) => ({ value: toTagKey(tag.name), label: tag.label })),
];

const buildOrderingOptions = (): WorkspaceOption<OrderingField>[] => [
  ...defaultOrderingOptions,
  ...dashboardTicketTags.map((tag) => ({ value: toTagKey(tag.name), label: tag.label })),
];

const buildDisplayPropertyOptions = (): WorkspaceOption<DisplayProperty>[] => [
  ...defaultDisplayPropertyOptions,
  ...dashboardTicketTags.map((tag) => ({ value: toTagKey(tag.name), label: tag.label })),
];

const getTicketFilterValues = (ticket: DashboardTicket, category: FilterCategory) => {
  if (category === "status") return ticket.status ? [ticket.status] : [];
  if (category === "assignee") return ticket.assignee ? [ticket.assignee] : [];

  const tagName = category.slice(4);
  const tag = ticket.tags.find((candidate) => candidate.name === tagName);
  return tag ? [tag.value] : [];
};

const countFilterValues = (category: FilterCategory) => {
  const counts: Record<string, number> = {};

  for (const ticket of dashboardTickets) {
    for (const value of getTicketFilterValues(ticket, category)) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
};

const buildFilterCategories = (): WorkspaceFilterCategory[] => {
  const assigneeOptions = [...new Set(dashboardTickets.map((ticket) => ticket.assignee).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));

  return [
    {
      id: "status",
      label: "Status",
      options: dashboardStatusColumns.map((column) => ({ value: column.id, label: column.label })),
    },
    { id: "assignee", label: "Assignee", options: assigneeOptions },
    ...dashboardTicketTags.map((tag) => ({
      id: toTagKey(tag.name),
      label: tag.label,
      options: tag.options.map((option) => ({ value: option.value, label: option.label })),
    })),
  ];
};

const buildCountsByCategory = (categories: WorkspaceFilterCategory[]) =>
  Object.fromEntries(categories.map((category) => [category.id, countFilterValues(category.id)]));

export const DashboardTicketControls = () => {
  const settings = useTicketsWorkspaceStore(dashboardTicketsWorkspaceStorageKey, (state) => state.settings);
  const filters = useTicketsWorkspaceStore(dashboardTicketsWorkspaceStorageKey, (state) => state.filters);
  const setViewMode = useTicketsWorkspaceStore(dashboardTicketsWorkspaceStorageKey, (state) => state.setViewMode);
  const setColumnGrouping = useTicketsWorkspaceStore(
    dashboardTicketsWorkspaceStorageKey,
    (state) => state.setColumnGrouping,
  );
  const setRowGrouping = useTicketsWorkspaceStore(dashboardTicketsWorkspaceStorageKey, (state) => state.setRowGrouping);
  const setOrderingField = useTicketsWorkspaceStore(
    dashboardTicketsWorkspaceStorageKey,
    (state) => state.setOrderingField,
  );
  const toggleSortDirection = useTicketsWorkspaceStore(
    dashboardTicketsWorkspaceStorageKey,
    (state) => state.toggleSortDirection,
  );
  const toggleDisplayProperty = useTicketsWorkspaceStore(
    dashboardTicketsWorkspaceStorageKey,
    (state) => state.toggleDisplayProperty,
  );
  const toggleFilterValue = useTicketsWorkspaceStore(
    dashboardTicketsWorkspaceStorageKey,
    (state) => state.toggleFilterValue,
  );
  const clearFilter = useTicketsWorkspaceStore(dashboardTicketsWorkspaceStorageKey, (state) => state.clearFilter);
  const clearAllFilters = useTicketsWorkspaceStore(
    dashboardTicketsWorkspaceStorageKey,
    (state) => state.clearAllFilters,
  );
  const filterCategories = buildFilterCategories();

  return (
    <HStack gap="2xs" flexShrink={0}>
      <FilterMenu
        categories={filterCategories}
        filters={filters as FilterState}
        countsByCategory={buildCountsByCategory(filterCategories)}
        onToggleFilterValue={toggleFilterValue}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
      />
      <DisplayMenu
        settings={settings}
        groupingOptions={buildGroupingOptions()}
        orderingOptions={buildOrderingOptions()}
        displayPropertyOptions={buildDisplayPropertyOptions()}
        onViewModeChange={setViewMode}
        onColumnGroupingChange={setColumnGrouping}
        onRowGroupingChange={setRowGrouping}
        onOrderingFieldChange={setOrderingField}
        onSortDirectionToggle={toggleSortDirection}
        onDisplayPropertyToggle={toggleDisplayProperty}
      />
    </HStack>
  );
};
