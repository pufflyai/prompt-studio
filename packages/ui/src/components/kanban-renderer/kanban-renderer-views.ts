import type { KanbanRendererFilterState, KanbanRendererSavedView, KanbanRendererSettings } from "./types";

interface KanbanRendererViewState {
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
}

const cloneSettings = (settings: KanbanRendererSettings): KanbanRendererSettings => ({
  ...settings,
  ordering: { ...settings.ordering },
  displayProperties: [...settings.displayProperties],
});

const cloneFilters = (filters: KanbanRendererFilterState): KanbanRendererFilterState =>
  Object.fromEntries(Object.entries(filters).map(([id, values]) => [id, [...values]]));

export const snapshotKanbanRendererView = (
  id: string,
  title: string,
  state: KanbanRendererViewState,
  isDefault = false,
): KanbanRendererSavedView => ({
  id,
  title,
  settings: cloneSettings(state.settings),
  filters: cloneFilters(state.filters),
  ...(isDefault ? { isDefault: true } : {}),
});

export const applyKanbanRendererView = (view: KanbanRendererSavedView) => ({
  settings: cloneSettings(view.settings),
  filters: cloneFilters(view.filters),
});

const comparableSettings = (settings: KanbanRendererSettings) => ({
  viewMode: settings.viewMode,
  columnGrouping: settings.columnGrouping,
  rowGrouping: settings.rowGrouping,
  ordering: settings.ordering,
  displayProperties: [...settings.displayProperties].sort(),
});

const comparableFilters = (filters: KanbanRendererFilterState) =>
  Object.fromEntries(
    Object.entries(filters)
      .filter(([, values]) => values.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, values]) => [id, [...values].sort()]),
  );

export const isKanbanRendererViewDirty = (
  view: KanbanRendererSavedView | undefined,
  state: KanbanRendererViewState,
) => {
  if (!view) return false;
  return (
    JSON.stringify(comparableSettings(view.settings)) !== JSON.stringify(comparableSettings(state.settings)) ||
    JSON.stringify(comparableFilters(view.filters)) !== JSON.stringify(comparableFilters(state.filters))
  );
};
