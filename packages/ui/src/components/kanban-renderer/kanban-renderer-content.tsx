import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { CollectionFilterEmptyState } from "../collection-view/collection-filter-empty-state";
import { CollectionViewEmptyState } from "../collection-view/collection-view-empty-state";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";
import { KanbanRendererList, type KanbanRendererListItem } from "./kanban-renderer-list";
import type { KanbanRendererSettings } from "./types";

interface KanbanRendererEmptyStateProps {
  emptyState?: ReactNode;
  title: string;
  description?: string;
  height?: string;
}

interface KanbanRendererContentProps {
  contentPlaceholder?: ReactNode;
  sourceCount: number;
  filteredCount: number;
  visibleCount: number;
  search: string;
  ruleCount: number;
  onClearSearch: () => void;
  onEditFilter?: () => void;
  viewMode: KanbanRendererSettings["viewMode"];
  boardColumns: KanbanRendererBoardColumn[];
  listItems: KanbanRendererListItem[];
  listExpandedGroups: Record<string, boolean>;
  selectedRowId: string | null;
  emptyState?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  onBoardMoveItem: (
    rowId: string,
    targetColumnId: string,
    context?: { beforeItemId?: string; targetGroupKey?: string },
  ) => Promise<void> | void;
  onBoardMoveToGroup: (
    rowId: string,
    targetGroupKey: string,
    context?: { beforeItemId?: string },
  ) => Promise<void> | void;
  onCreateRow?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  onListExpandedGroupChange: (rowId: string, isExpanded: boolean) => void;
  listKey: string;
}

const KanbanRendererEmptyState = (props: KanbanRendererEmptyStateProps) => {
  const { emptyState, title, description, height } = props;

  if (emptyState !== undefined) {
    return height ? <Box height={height}>{emptyState}</Box> : emptyState;
  }

  return <EmptyState title={title} description={description} height={height} />;
};

export const KanbanRendererContent = (props: KanbanRendererContentProps) => {
  const {
    contentPlaceholder,
    sourceCount,
    filteredCount,
    visibleCount,
    search,
    ruleCount,
    onClearSearch,
    onEditFilter,
    viewMode,
    boardColumns,
    listItems,
    listExpandedGroups,
    selectedRowId,
    emptyState,
    emptyTitle,
    emptyDescription,
    onBoardMoveItem,
    onBoardMoveToGroup,
    onCreateRow,
    onColumnAction,
    onListExpandedGroupChange,
    listKey,
  } = props;

  if (contentPlaceholder !== undefined) return contentPlaceholder;
  if (sourceCount > 0 && visibleCount === 0 && search.trim())
    return <CollectionViewEmptyState search={search} onClearSearch={onClearSearch} />;

  const filteredOut = sourceCount > 0 && filteredCount === 0;
  const filterMessage = filteredOut ? (
    <CollectionFilterEmptyState ruleCount={ruleCount} hiddenCount={sourceCount} onEditFilter={onEditFilter} />
  ) : null;

  if (viewMode === "board") {
    return (
      <>
        {filterMessage}
        <Box flex="1" minH="0">
          {boardColumns.length > 0 ? (
            <KanbanRendererBoard
              columns={boardColumns}
              selectedItemId={selectedRowId}
              onMoveItem={onBoardMoveItem}
              onMoveToGroup={onBoardMoveToGroup}
              onCreateStart={onCreateRow}
              onColumnAction={onColumnAction}
            />
          ) : null}
          {boardColumns.length === 0 && !filteredOut ? (
            <KanbanRendererEmptyState
              emptyState={emptyState}
              title={emptyTitle}
              description={emptyDescription}
              height="100%"
            />
          ) : null}
        </Box>
      </>
    );
  }

  if (listItems.length > 0) {
    return (
      <>
        {filterMessage}
        <ScrollArea flex="1" minH="0" viewportProps={{ "aria-label": "Collection list" }}>
          <KanbanRendererList
            key={listKey}
            items={listItems}
            selectedItemId={selectedRowId}
            expandedGroups={listExpandedGroups}
            onExpandedGroupChange={onListExpandedGroupChange}
          />
        </ScrollArea>
      </>
    );
  }

  if (filteredOut) return filterMessage;
  return <KanbanRendererEmptyState emptyState={emptyState} title={emptyTitle} description={emptyDescription} />;
};
