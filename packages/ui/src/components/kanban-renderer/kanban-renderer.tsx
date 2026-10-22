import { Stack } from "@chakra-ui/react";
import type { KanbanRendererMove, ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import { type ReactNode, useDeferredValue, useState } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { withTitleField } from "../collection-view/collection-view-fields";
import { countFilterRules } from "../collection-view/collection-view-filter";
import { useCollectionViews } from "../collection-view/use-collection-views";
import type { KanbanActionErrorHandler } from "./kanban-renderer-action";
import type { KanbanRendererBoardColumnAction } from "./kanban-renderer-board";
import { buildKanbanBoardColumns, narrowKanbanRows } from "./kanban-renderer-board-columns";
import { KanbanRendererContent } from "./kanban-renderer-content";
import { KanbanRendererCreateDialog } from "./kanban-renderer-create-dialog";
import { groupRows } from "./kanban-renderer-grouping";
import { resolveKnownColumnKeys } from "./kanban-renderer-helpers";
import { buildKanbanRendererListItems } from "./kanban-renderer-list-items";
import { kanbanMoveHandlers } from "./kanban-renderer-move-handlers";
import { KanbanRendererToolbar } from "./kanban-renderer-toolbar";
import type {
  AttributeDescriptor,
  KanbanRendererCreateRowConfig,
  KanbanRendererCreateSubmission,
  KanbanRendererRow,
  KanbanRendererSavedView,
  KanbanRendererSettings,
  KanbanRendererViewsSource,
} from "./types";
import { NO_GROUPING } from "./types";
import { kanbanRendererInitialState, useKanbanRendererStore } from "./use-kanban-renderer-store";
import { useResolvedAttributes } from "./use-resolved-attributes";

/** Board-column behavior and menu configuration for a resolved column group. */
export interface BoardColumnConfig {
  /** Chakra color palette used for the column header and group badges. */
  color?: string;
  /** @deprecated Remove this option. Cards can always be dragged between columns. */
  canDragIn?: boolean;
  /** @deprecated Remove this option. Cards can always be dragged between columns. */
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: KanbanRendererBoardColumnAction[];
}

/** Switchable list/board renderer for rows with typed attributes, filtering, grouping, and ordering. */
export interface KanbanRendererProps<TRow extends KanbanRendererRow = KanbanRendererRow> {
  /** Stable rows to render. Each row must have an id, title, and attributes map. */
  rows: TRow[];
  /** Persistent key used by the renderer store for view, filter, grouping, ordering, and list expansion settings. */
  storageKey: string;
  itemLabel?: string;
  /** Attribute descriptors that define display, filtering, grouping, ordering, and board columns. */
  attributes: AttributeDescriptor[];
  selectedRowId?: string | null;
  emptyState?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Replaces the data area while a query is unavailable, keeping its controls mounted. */
  contentPlaceholder?: ReactNode;
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  viewsSource?: KanbanRendererViewsSource;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
  hideToolbar?: boolean;
  toolbarActions?: ReactNode;
  toolbarLeading?: ReactNode;
  onRowClick?: (row: TRow) => void;
  /** Reports a failed badge edit or complete move once and consumes its rejection. */
  onActionError?: KanbanActionErrorHandler;
  /** Called when a row attribute changes through drag/drop, board movement, or inline controls. */
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  /** Called for manual row ordering when a dragged row is dropped before another row. Only used while the view has no sorts. */
  onMove?: (move: KanbanRendererMove) => Promise<void> | void;
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
  createRow?: KanbanRendererCreateRowConfig;
  onCreateRow?: (submission: KanbanRendererCreateSubmission) => Promise<void> | void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
}

export const KanbanRenderer = <TRow extends KanbanRendererRow>(props: KanbanRendererProps<TRow>) => {
  const {
    rows,
    storageKey,
    attributes: rawAttributes,
    selectedRowId = null,
    emptyState,
    emptyTitle = "No rows found",
    emptyDescription = "Try changing filters or display settings.",
    contentPlaceholder,
    defaultSettings,
    defaultFilter,
    defaultSorts,
    viewsSource,
    defaultViews,
    defaultActiveViewId,
    onRowClick,
    onActionError,
    onAttributeChange,
    onReorder,
    onMove,
    createRow,
    onCreateRow,
    onColumnAction,
    getBoardColumnConfig,
    getRowContextMenuActions,
    hideToolbar = false,
    toolbarActions,
    toolbarLeading,
  } = props;

  const initialState = kanbanRendererInitialState({
    settings: defaultSettings,
    filter: defaultFilter,
    sorts: defaultSorts,
  });
  const attributes = useResolvedAttributes(rawAttributes);
  const fields = withTitleField(attributes);
  useCollectionViews({ ...props, initialState, fields });
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Typing stays responsive on large boards; the narrowed rows follow a frame later.
  const deferredSearch = useDeferredValue(search);
  const settings = useKanbanRendererStore(storageKey, (state) => state.settings, initialState);
  const filter = useKanbanRendererStore(storageKey, (state) => state.filter, initialState);
  const activeViewId = useKanbanRendererStore(storageKey, (state) => state.activeViewId, initialState);
  const sorts = useKanbanRendererStore(storageKey, (state) => state.sorts, initialState);
  const expandedGroups = useKanbanRendererStore(storageKey, (state) => state.expandedGroups, initialState);
  const setExpandedGroup = useKanbanRendererStore(storageKey, (state) => state.setExpandedGroup, initialState);
  const setOpenMenu = useKanbanRendererStore(storageKey, (state) => state.setOpenMenu, initialState);

  const { filteredRows, visibleRows, columnTotals } = narrowKanbanRows({
    rows,
    filter,
    fields,
    attributes,
    settings,
    search: deferredSearch,
  });
  const searching = deferredSearch.trim() !== "";
  const grouped = groupRows(visibleRows, {
    attributes,
    columnGrouping: settings.columnGrouping,
    rowGrouping: settings.rowGrouping,
    knownColumnKeys: resolveKnownColumnKeys(settings.columnGrouping, attributes, filter, rows),
    structureRows: rows,
  });

  const listItems =
    settings.viewMode === "list"
      ? buildKanbanRendererListItems({
          settings,
          sorts,
          search: deferredSearch,
          visibleRows,
          grouped,
          attributes,
          onRowClick,
          onActionError,
          onAttributeChange,
          onReorder,
          onMove,
          getRowContextMenuActions,
        })
      : [];

  const boardColumns =
    settings.viewMode === "board"
      ? buildKanbanBoardColumns({
          grouped,
          settings,
          sorts,
          fields,
          attributes,
          search: deferredSearch,
          columnTotals: searching ? columnTotals : undefined,
          getBoardColumnConfig,
          getRowContextMenuActions,
          onAttributeChange,
          onActionError,
          onRowClick,
        })
      : [];

  const { handleBoardMoveItem, handleBoardMoveToGroup } = kanbanMoveHandlers({
    settings,
    sorts,
    onMove,
    onActionError,
    onAttributeChange,
    onReorder,
  });

  return (
    <Stack data-testid="kanban-renderer" height="100%" minH="0" gap="0" background="bg" overflow="hidden">
      {hideToolbar ? null : (
        <KanbanRendererToolbar
          itemLabel={props.itemLabel}
          rows={rows}
          storageKey={storageKey}
          attributes={attributes}
          defaultSettings={defaultSettings}
          defaultFilter={defaultFilter}
          defaultSorts={defaultSorts}
          search={search}
          onSearchChange={setSearch}
          searchResultLabel={searching ? `${visibleRows.length} of ${filteredRows.length}` : undefined}
          viewsSource={viewsSource}
          defaultViews={defaultViews}
          defaultActiveViewId={defaultActiveViewId}
          leading={toolbarLeading}
          actions={toolbarActions}
        />
      )}

      <KanbanRendererContent
        contentPlaceholder={contentPlaceholder}
        sourceCount={rows.length}
        filteredCount={filteredRows.length}
        visibleCount={visibleRows.length}
        search={deferredSearch}
        ruleCount={countFilterRules(filter)}
        onClearSearch={() => setSearch("")}
        onEditFilter={hideToolbar ? undefined : () => setOpenMenu("filter")}
        viewMode={settings.viewMode}
        boardColumns={boardColumns}
        listItems={listItems}
        listExpandedGroups={expandedGroups}
        selectedRowId={selectedRowId}
        emptyState={emptyState}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onBoardMoveItem={handleBoardMoveItem}
        onBoardMoveToGroup={handleBoardMoveToGroup}
        onCreateRow={createRow && onCreateRow ? setCreateColumnId : undefined}
        onColumnAction={onColumnAction}
        onListExpandedGroupChange={setExpandedGroup}
        listKey={`${settings.columnGrouping}:${settings.rowGrouping}`}
      />
      {createRow && onCreateRow && createColumnId ? (
        <KanbanRendererCreateDialog
          open
          columnId={createColumnId}
          columnAttributeId={settings.columnGrouping === NO_GROUPING ? undefined : settings.columnGrouping}
          attributes={attributes}
          config={createRow}
          draftKey={JSON.stringify([storageKey, activeViewId, filter])}
          filter={filter}
          onClose={() => setCreateColumnId(null)}
          onSubmit={onCreateRow}
        />
      ) : null}
    </Stack>
  );
};
