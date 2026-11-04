import { Stack } from "@chakra-ui/react";
import { useState } from "react";
import { withTitleField } from "../collection-view/collection-view-fields";
import { countFilterRules } from "../collection-view/collection-view-filter";
import { useCollectionViews } from "../collection-view/use-collection-views";
import type { KanbanRendererProps } from "./kanban-renderer";
import { KanbanRendererContent } from "./kanban-renderer-content";
import { KanbanRendererCreateDialog } from "./kanban-renderer-create-dialog";
import { KanbanRendererToolbar } from "./kanban-renderer-toolbar";
import { buildResourceListItems, countResourceListRows, resourceListSettings } from "./resource-list-view-model";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

export type ResourceListRendererProps = Omit<KanbanRendererProps, "onMove" | "onReorder">;

export const ResourceListRenderer = (props: ResourceListRendererProps) => {
  const { rows, storageKey } = props;
  const attributes = useResolvedAttributes(props.attributes);
  const initialState = {
    settings: resourceListSettings(props.defaultSettings ?? {}),
    filter: props.defaultFilter,
    sorts: props.defaultSorts,
  };
  const state = useKanbanRendererStore(storageKey, (state) => state, initialState);
  const settings = resourceListSettings(state.settings);
  const [localSearch, setLocalSearch] = useState("");
  const search = props.page?.request.search ?? localSearch;
  const setSearch = props.page?.onSearchChange ?? setLocalSearch;
  const [createGroup, setCreateGroup] = useState<string | null>(null);
  useCollectionViews({ ...props, initialState, fields: withTitleField(attributes) });
  const items = buildResourceListItems({
    ...props,
    attributes,
    settings,
    filter: state.filter,
    sorts: state.sorts,
    search,
    onCreate: props.createRow && props.onCreateRow ? setCreateGroup : undefined,
  });
  return (
    <Stack data-testid="resource-list-renderer" height="full" minH="0" gap="0" bg="bg" overflow="hidden">
      {props.hideToolbar ? null : (
        <KanbanRendererToolbar
          {...props}
          actions={props.toolbarActions}
          leading={props.toolbarLeading}
          defaultSettings={initialState.settings}
          resourceList
          attributes={attributes}
          search={search}
          onSearchChange={setSearch}
        />
      )}
      <KanbanRendererContent
        contentPlaceholder={props.contentPlaceholder}
        sourceCount={props.page?.result?.total ?? rows.length}
        filteredCount={props.page?.result?.filteredTotal ?? countResourceListRows(items)}
        visibleCount={countResourceListRows(items)}
        search={search}
        ruleCount={countFilterRules(state.filter)}
        onClearSearch={() => setSearch("")}
        onEditFilter={props.hideToolbar ? undefined : () => state.setOpenMenu("filter")}
        viewMode="list"
        boardColumns={[]}
        listItems={items}
        onBoardMoveItem={() => {}}
        onBoardMoveToGroup={() => {}}
        listExpandedGroups={state.expandedGroups}
        onListExpandedGroupChange={state.setExpandedGroup}
        selectedRowId={props.selectedRowId ?? null}
        emptyState={props.emptyState}
        emptyTitle={props.emptyTitle || "No resources found"}
        emptyDescription={props.emptyDescription ?? ""}
        listKey={settings.columnGrouping}
        onLoadMore={props.page?.result?.cursor ? props.page.onLoadMore : undefined}
        loadingMore={props.page?.loading}
      />
      {props.createRow && props.onCreateRow && createGroup !== null ? (
        <KanbanRendererCreateDialog
          open
          columnId={createGroup}
          columnAttributeId={settings.columnGrouping === "none" ? undefined : settings.columnGrouping}
          attributes={attributes}
          config={props.createRow}
          filter={state.filter}
          draftKey={JSON.stringify([storageKey, state.activeViewId, state.filter])}
          onClose={() => setCreateGroup(null)}
          onSubmit={props.onCreateRow}
        />
      ) : null}
    </Stack>
  );
};
