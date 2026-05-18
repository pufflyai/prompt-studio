import { Stack } from "@chakra-ui/react";
import { DataRenderer, type DataRendererRow, type FilterCategory, useDataRendererStore } from "@pstdio/ui";
import { useEffect, useMemo, useState } from "react";
import type {
  DataRendererQueryState,
  FilterExpression,
  RegisteredDataRendererContribution,
  ViewDisplayOptions,
  WorkbenchCore,
  WorkbenchSavedView,
  WorkbenchWidgetPlacement,
} from "../../core";
import {
  type DataRendererViewSnapshot,
  filtersToExpression,
  savedViewEqualsSnapshot,
  settingsToDisplay,
  viewToStore,
} from "./saved-view-mapping";
import { SavedViewMenu } from "./saved-view-menu";

interface WorkbenchDataViewProps {
  workbench: WorkbenchCore;
  contribution: RegisteredDataRendererContribution;
  placement: WorkbenchWidgetPlacement;
}

const resolveStorageKey = (dataRendererId: string, placement: WorkbenchWidgetPlacement) => {
  if (placement.resource?.kind === "savedView" && placement.resource.id) {
    return `pstdio:workbench:savedView:${placement.resource.id}`;
  }
  return `pstdio:workbench:dataRenderer:${dataRendererId}:${placement.widgetId}`;
};

const getViewSnapshotFromResource = (placement: WorkbenchWidgetPlacement): DataRendererViewSnapshot | undefined => {
  const resource = placement.resource;
  if (resource?.kind !== "savedView") return undefined;
  const filter = resource.metadata?.filter as FilterExpression | undefined;
  const display = resource.metadata?.display as ViewDisplayOptions | undefined;
  if (!filter || !display) return undefined;
  return { filter, display };
};

export const WorkbenchDataView = (props: WorkbenchDataViewProps) => {
  const { workbench, contribution, placement } = props;
  const storageKey = resolveStorageKey(contribution.id, placement);
  const savedViewSnapshotKey = JSON.stringify(getViewSnapshotFromResource(placement) ?? null);

  const settings = useDataRendererStore(storageKey, (state) => state.settings);
  const filters = useDataRendererStore(storageKey, (state) => state.filters);
  const setViewMode = useDataRendererStore(storageKey, (state) => state.setViewMode);
  const setColumnGrouping = useDataRendererStore(storageKey, (state) => state.setColumnGrouping);
  const setRowGrouping = useDataRendererStore(storageKey, (state) => state.setRowGrouping);
  const setOrdering = useDataRendererStore(storageKey, (state) => state.setOrdering);
  const setDisplayProperties = useDataRendererStore(storageKey, (state) => state.setDisplayProperties);
  const clearAllFilters = useDataRendererStore(storageKey, (state) => state.clearAllFilters);
  const setFilter = useDataRendererStore(storageKey, (state) => state.setFilter);

  const [rows, setRows] = useState<DataRendererRow[]>([]);
  const [activeView, setActiveView] = useState<WorkbenchSavedView | undefined>(undefined);

  // Apply saved-view metadata when the placement's resource is a saved view.
  useEffect(() => {
    const snapshot = JSON.parse(savedViewSnapshotKey) as DataRendererViewSnapshot | null;
    if (!snapshot) return;
    const { filters: nextFilters, settings: nextSettings } = viewToStore(snapshot);
    setViewMode(nextSettings.viewMode);
    setColumnGrouping(nextSettings.columnGrouping);
    setRowGrouping(nextSettings.rowGrouping);
    setOrdering(nextSettings.ordering);
    setDisplayProperties(nextSettings.displayProperties);
    clearAllFilters();
    for (const [category, values] of Object.entries(nextFilters)) {
      if (!values) continue;
      setFilter(category as FilterCategory, values);
    }
  }, [
    savedViewSnapshotKey,
    setViewMode,
    setColumnGrouping,
    setRowGrouping,
    setOrdering,
    setDisplayProperties,
    clearAllFilters,
    setFilter,
  ]);

  // Resolve the active saved view (when applicable) so SavedViewMenu can render
  // its name and the dirty badge. Re-fetches on registry changes so rename /
  // update / delete in workbench.savedViews are reflected without remounting.
  useEffect(() => {
    let cancelled = false;
    const resourceId = placement.resource?.kind === "savedView" ? placement.resource.id : undefined;
    if (!resourceId) {
      setActiveView(undefined);
      return;
    }
    const refresh = () => {
      void workbench.savedViews.get(resourceId).then((view) => {
        if (cancelled) return;
        setActiveView(view ?? undefined);
      });
    };
    refresh();
    const disposable = workbench.savedViews.onDidChange(() => refresh());
    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [workbench, placement.resource]);

  // Run executeQuery whenever settings/filters change.
  useEffect(() => {
    let cancelled = false;
    const state: DataRendererQueryState = { settings, filters };
    Promise.resolve(contribution.executeQuery(state)).then((next) => {
      if (cancelled) return;
      setRows(next);
    });
    return () => {
      cancelled = true;
    };
  }, [contribution, settings, filters]);

  const currentSnapshot = useMemo<DataRendererViewSnapshot>(
    () => ({
      filter: filtersToExpression(filters) ?? { field: "_", operator: "is", value: "" },
      display: settingsToDisplay(settings),
    }),
    [filters, settings],
  );

  const dirty = activeView ? !savedViewEqualsSnapshot(activeView, currentSnapshot) : false;

  const savedViewsConfig = contribution.savedViews;

  const onSave = async () => {
    if (!activeView) return;
    await workbench.savedViews.update(activeView.id, {
      filter: currentSnapshot.filter,
      display: currentSnapshot.display,
    });
  };
  const onSaveAs = async (name: string) => {
    if (!savedViewsConfig) return;
    const view = await workbench.savedViews.create({
      name,
      resourceKind: savedViewsConfig.resourceKind,
      scope: savedViewsConfig.scope,
      projectId: savedViewsConfig.projectId,
      filter: currentSnapshot.filter,
      display: currentSnapshot.display,
    });
    await workbench.resources
      .openResource(
        {
          kind: "savedView",
          id: view.id,
          uri: `pstdio://views/${view.id}`,
          label: view.name,
          icon: "Table",
          metadata: { resourceKind: view.resourceKind, filter: view.filter, display: view.display },
        },
        { replaceActive: true },
      )
      .catch(() => undefined);
  };
  const onRename = async (name: string) => {
    if (!activeView) return;
    await workbench.savedViews.update(activeView.id, { name });
  };
  const onDuplicate = async (name?: string) => {
    if (!activeView || !savedViewsConfig) return;
    const view = await workbench.savedViews.create({
      name: name ?? `${activeView.name} Copy`,
      resourceKind: savedViewsConfig.resourceKind,
      scope: savedViewsConfig.scope,
      projectId: savedViewsConfig.projectId,
      filter: activeView.filter,
      display: activeView.display,
    });
    await workbench.resources
      .openResource(
        {
          kind: "savedView",
          id: view.id,
          uri: `pstdio://views/${view.id}`,
          label: view.name,
          icon: "Table",
          metadata: { resourceKind: view.resourceKind, filter: view.filter, display: view.display },
        },
        { replaceActive: true },
      )
      .catch(() => undefined);
  };
  const onDelete = async () => {
    if (!activeView) return;
    await workbench.savedViews.delete(activeView.id);
  };

  const savedViewMenu = savedViewsConfig ? (
    <SavedViewMenu
      activeView={activeView}
      dirty={dirty}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onRename={onRename}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
  ) : undefined;

  return (
    <Stack h="full" minH="0" gap="0" bg="bg">
      <DataRenderer
        tickets={rows}
        storageKey={storageKey}
        tagDefinitions={contribution.tagDefinitions}
        groupingOptions={contribution.groupingOptions}
        orderingOptions={contribution.orderingOptions}
        displayPropertyOptions={contribution.displayPropertyOptions}
        filterCategories={contribution.filterCategories}
        knownColumnKeys={contribution.knownColumnKeys}
        getBoardColumnConfig={contribution.getBoardColumnConfig}
        toolbarLeading={savedViewMenu}
        onTicketClick={contribution.onTicketClick}
        onTagChange={contribution.onTagChange}
        onMoveTicket={contribution.onMoveTicket}
        onMoveToGroup={contribution.onMoveToGroup}
        onCreateTicket={contribution.onCreateTicket}
        onColumnAction={contribution.onColumnAction}
      />
    </Stack>
  );
};
