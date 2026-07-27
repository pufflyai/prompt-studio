import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/primitives/empty-state";
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

  if (viewMode === "board") {
    return (
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
        ) : (
          <KanbanRendererEmptyState
            emptyState={emptyState}
            title={emptyTitle}
            description={emptyDescription}
            height="100%"
          />
        )}
      </Box>
    );
  }

  if (listItems.length > 0) {
    return (
      <KanbanRendererList
        key={listKey}
        items={listItems}
        selectedItemId={selectedRowId}
        expandedGroups={listExpandedGroups}
        onExpandedGroupChange={onListExpandedGroupChange}
      />
    );
  }

  return <KanbanRendererEmptyState emptyState={emptyState} title={emptyTitle} description={emptyDescription} />;
};
