import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";
import { CollectionViewBar } from "../collection-view/collection-view-bar";
import { withTitleField } from "../collection-view/collection-view-fields";
import { DisplaySortControl } from "../collection-view/display-sort-control";
import type { RuleValueOption } from "../collection-view/filter-rule-value";
import { useCollectionViews } from "../collection-view/use-collection-views";
import { DisplayMenu } from "./display-menu";
import { countFilterValues } from "./kanban-renderer-grouping";
import { buildDisplayPropertyOptions, buildFilterCategories, buildGroupingOptions } from "./kanban-renderer-helpers";
import type {
  AttributeDescriptor,
  KanbanRendererRow,
  KanbanRendererSavedView,
  KanbanRendererSettings,
  KanbanRendererViewsSource,
} from "./types";
import { kanbanRendererInitialState, useKanbanRendererStore } from "./use-kanban-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

export interface KanbanRendererToolbarProps<TRow extends KanbanRendererRow = KanbanRendererRow> {
  rows: TRow[];
  storageKey: string;
  itemLabel?: string;
  attributes: AttributeDescriptor[];
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  viewsSource?: KanbanRendererViewsSource;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchResultLabel?: string;
  leading?: ReactNode;
  actions?: ReactNode;
}

const toggle = (values: string[], value: string) =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

export const KanbanRendererToolbar = <TRow extends KanbanRendererRow>(props: KanbanRendererToolbarProps<TRow>) => {
  const { rows, storageKey, attributes: rawAttributes, defaultSettings, defaultFilter, defaultSorts } = props;
  const { search, onSearchChange, searchResultLabel, leading, actions } = props;
  const initialState = kanbanRendererInitialState({
    settings: defaultSettings,
    filter: defaultFilter,
    sorts: defaultSorts,
  });
  const attributes = useResolvedAttributes(rawAttributes);
  const viewState = useCollectionViews({ ...props, initialState, fields: attributes });
  const { settings, setSettings, sorts, setSorts } = useKanbanRendererStore(storageKey, (state) => state, initialState);
  const categories = buildFilterCategories(attributes, rows);
  const optionsFor = (field: AttributeDescriptor): RuleValueOption[] => {
    const counts = countFilterValues(rows, field.id, attributes);
    const category = categories.find((entry) => entry.id === field.id);
    return (category?.options ?? []).map((option) => ({ ...option, count: counts[option.value] ?? 0 }));
  };

  return (
    <CollectionViewBar
      itemLabel={props.itemLabel}
      storageKey={storageKey}
      initialState={initialState}
      views={viewState.views}
      defaultViewId={viewState.defaultId}
      viewsSource={props.viewsSource}
      fields={withTitleField(attributes)}
      optionsFor={optionsFor}
      search={search}
      onSearchChange={onSearchChange}
      searchResultLabel={searchResultLabel}
      leading={leading}
      actions={actions}
      displayControl={
        <DisplayMenu
          settings={settings}
          sortControl={
            <DisplaySortControl fields={withTitleField(attributes)} sorts={sorts} onSortsChange={setSorts} />
          }
          groupingOptions={buildGroupingOptions(attributes)}
          displayPropertyOptions={buildDisplayPropertyOptions(attributes)}
          onViewModeChange={(viewMode) => setSettings({ viewMode })}
          onColumnGroupingChange={(columnGrouping) => setSettings({ columnGrouping })}
          onRowGroupingChange={(rowGrouping) => setSettings({ rowGrouping })}
          onDisplayPropertyToggle={(property) =>
            setSettings({ displayProperties: toggle(settings.displayProperties, property) })
          }
        />
      }
    />
  );
};
