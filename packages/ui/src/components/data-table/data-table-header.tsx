import type { ReactNode } from "react";
import { CollectionViewBar } from "../collection-view/collection-view-bar";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import type { DataTableViewsSource } from "./types";
import type { useDataTableView } from "./use-data-table-view";

interface DataTableHeaderProps {
  itemLabel?: string;
  view: ReturnType<typeof useDataTableView>;
  viewsSource?: DataTableViewsSource;
  displayControl: ReactNode;
  actions?: ReactNode;
}

// Table columns have no option lists, so every rule is built in the rule editor.
const noOptions = (_field: AttributeDescriptor) => [];

/** The table uses the same view bar as boards: saved views, Search, Filter, Sort, and Display. */
export const DataTableHeader = (props: DataTableHeaderProps) => {
  const { view, viewsSource, displayControl, actions } = props;
  const searching = view.deferredSearch.trim() !== "";

  return (
    <CollectionViewBar
      itemLabel={props.itemLabel}
      storageKey={view.storageKey}
      initialState={view.initialState}
      views={view.views.views}
      defaultViewId={view.views.defaultId}
      viewsSource={viewsSource}
      fields={view.attributes}
      optionsFor={noOptions}
      search={view.search}
      onSearchChange={view.setSearch}
      searchResultLabel={searching ? `${view.shownRows.length} of ${view.filteredRows.length}` : undefined}
      displayControl={displayControl}
      actions={actions}
    />
  );
};
