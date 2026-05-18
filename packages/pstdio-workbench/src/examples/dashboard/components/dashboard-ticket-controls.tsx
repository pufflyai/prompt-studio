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
import { useEffect, useState } from "react";
import type { ResourceRef, WorkbenchCore, WorkbenchSavedView } from "../../../core";
import {
  createSavedViewResource,
  dashboardCollectionsProjectId,
  resolveTicketsWorkspaceStorageKey,
} from "../collections/saved-view-resources";
import { savedViewEqualsSnapshot, ticketStoreToView } from "../collections/ticket-view-mapping";
import { dashboardResources, dashboardStatusColumns, dashboardTickets, dashboardTicketTags } from "../mock-data/data";
import { SavedViewMenu } from "./saved-view-menu";

type DashboardTicket = (typeof dashboardTickets)[number];

interface DashboardTicketControlsProps {
  workbench: WorkbenchCore;
  activeResource?: ResourceRef;
}

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

export const DashboardTicketControls = (props: DashboardTicketControlsProps) => {
  const { activeResource, workbench } = props;
  const storageKey = resolveTicketsWorkspaceStorageKey(activeResource);
  const activeViewId = activeResource?.kind === "savedView" ? activeResource.id : undefined;
  const [activeView, setActiveView] = useState<WorkbenchSavedView | undefined>();
  const [savedViewsVersion, setSavedViewsVersion] = useState(0);
  const settings = useTicketsWorkspaceStore(storageKey, (state) => state.settings);
  const filters = useTicketsWorkspaceStore(storageKey, (state) => state.filters);
  const snapshot = ticketStoreToView({ settings, filters });
  const setViewMode = useTicketsWorkspaceStore(storageKey, (state) => state.setViewMode);
  const setColumnGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setColumnGrouping);
  const setRowGrouping = useTicketsWorkspaceStore(storageKey, (state) => state.setRowGrouping);
  const setOrderingField = useTicketsWorkspaceStore(storageKey, (state) => state.setOrderingField);
  const toggleSortDirection = useTicketsWorkspaceStore(storageKey, (state) => state.toggleSortDirection);
  const toggleDisplayProperty = useTicketsWorkspaceStore(storageKey, (state) => state.toggleDisplayProperty);
  const toggleFilterValue = useTicketsWorkspaceStore(storageKey, (state) => state.toggleFilterValue);
  const clearFilter = useTicketsWorkspaceStore(storageKey, (state) => state.clearFilter);
  const clearAllFilters = useTicketsWorkspaceStore(storageKey, (state) => state.clearAllFilters);
  const filterCategories = buildFilterCategories();
  const dirty = activeView ? !savedViewEqualsSnapshot(activeView, snapshot) : true;

  useEffect(() => {
    const disposable = workbench.savedViews.onDidChange(() => setSavedViewsVersion((version) => version + 1));
    return () => disposable.dispose();
  }, [workbench]);

  useEffect(() => {
    let disposed = false;
    void savedViewsVersion;
    if (!activeViewId) {
      setActiveView(undefined);
      return () => {
        disposed = true;
      };
    }

    void workbench.savedViews.get(activeViewId).then((view) => {
      if (!disposed) setActiveView(view);
    });

    return () => {
      disposed = true;
    };
  }, [workbench, activeViewId, savedViewsVersion]);

  const openSavedView = async (view: WorkbenchSavedView) => {
    await workbench.resources.openResource(createSavedViewResource(view), { replaceActive: true });
  };

  const saveView = async () => {
    if (!activeView) return;
    setActiveView(await workbench.savedViews.update(activeView.id, snapshot));
  };

  const saveViewAs = async (name: string) => {
    const view = await workbench.savedViews.create({
      name,
      resourceKind: "ticket",
      scope: "project",
      projectId: dashboardCollectionsProjectId,
      ...snapshot,
    });
    await openSavedView(view);
  };

  const renameView = async (name: string) => {
    if (!activeView) return;
    await openSavedView(await workbench.savedViews.update(activeView.id, { name }));
  };

  const duplicateView = async (name?: string) => {
    if (!activeView) return;
    await openSavedView(await workbench.savedViews.duplicate(activeView.id, { name }));
  };

  const deleteView = async () => {
    if (!activeView) return;
    await workbench.savedViews.delete(activeView.id);
    await workbench.resources.openResource(dashboardResources.tickets, { replaceActive: true });
  };

  return (
    <HStack gap="2xs" flexShrink={0}>
      <SavedViewMenu
        activeView={activeView}
        dirty={dirty}
        onSave={saveView}
        onSaveAs={saveViewAs}
        onRename={renameView}
        onDuplicate={duplicateView}
        onDelete={deleteView}
      />
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
