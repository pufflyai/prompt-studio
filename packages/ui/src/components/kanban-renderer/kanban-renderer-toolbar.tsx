import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";
import type { CollectionPageControl } from "../collection-view/collection-page";
import { CollectionViewBar } from "../collection-view/collection-view-bar";
import { withTitleField } from "../collection-view/collection-view-fields";
import { DisplaySortControl } from "../collection-view/display-sort-control";
import type { RuleValueOption } from "../collection-view/filter-rule-value";
import { useCollectionViews } from "../collection-view/use-collection-views";
import { DisplayMenu } from "./display-menu";
import { countFilterValues } from "./kanban-renderer-grouping";
import { buildDisplayPropertyOptions, buildFilterCategories, buildGroupingOptions } from "./kanban-renderer-helpers";
import { resourceListSettings } from "./resource-list-view-model";
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
  resourceList?: boolean;
  rows: TRow[];
  storageKey: string;
  page?: CollectionPageControl;
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
    const page = props.page?.result;
    const statistic = page?.statistics?.[field.id];
    const groups = page?.groups.filter(({ field: id, parent }) => id === field.id && !parent) ?? [];
    const fullyLoaded = !props.page || (page && !page.cursor && (props.page.displayed?.offset ?? 0) === 0);
    const counts =
      statistic?.type === "top-values"
        ? new Map(statistic.values.map(({ label, count }) => [label, count]))
        : new Map(Object.entries(fullyLoaded ? countFilterValues(rows, field.id, attributes) : {}));
    for (const group of groups) if (typeof group.value === "string") counts.set(group.value, group.count);
    const category = categories.find((entry) => entry.id === field.id);
    return (category?.options ?? []).map((option) => ({ ...option, count: counts.get(option.value) }));
  };

  return (
    <CollectionViewBar
      itemLabel={props.itemLabel}
      storageKey={storageKey}
      initialState={initialState}
      views={viewState.views}
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
          settings={props.resourceList ? resourceListSettings(settings) : settings}
          resourceList={props.resourceList}
          onShowChildrenChange={(showChildren) => setSettings({ showChildren })}
          onSubGroupingsChange={(subGroupings) => setSettings({ subGroupings })}
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
