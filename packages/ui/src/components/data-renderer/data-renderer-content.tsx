import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { DataRendererBoard, type DataRendererBoardColumn } from "./data-renderer-board";
import { DataRendererList, type DataRendererListItem } from "./data-renderer-list";
import type { DataRendererSettings } from "./types";

interface DataRendererEmptyStateProps {
  emptyState?: ReactNode;
  title: string;
  description?: string;
  height?: string;
}

interface DataRendererContentProps {
  viewMode: DataRendererSettings["viewMode"];
  boardColumns: DataRendererBoardColumn[];
  listItems: DataRendererListItem[];
  listExpandedGroups: Record<string, boolean>;
  selectedRowId: string | null;
  emptyState?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  onBoardMoveItem: (rowId: string, targetColumnId: string) => void;
  onBoardMoveToGroup: (rowId: string, targetGroupKey: string) => void;
  onCreateRow?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
  onListExpandedGroupChange: (rowId: string, isExpanded: boolean) => void;
  listKey: string;
}

const DataRendererEmptyState = (props: DataRendererEmptyStateProps) => {
  const { emptyState, title, description, height } = props;

  if (emptyState !== undefined) {
    return height ? <Box height={height}>{emptyState}</Box> : emptyState;
  }

  return <EmptyState title={title} description={description} height={height} />;
};

export const DataRendererContent = (props: DataRendererContentProps) => {
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
          <DataRendererBoard
            columns={boardColumns}
            selectedItemId={selectedRowId}
            onMoveItem={onBoardMoveItem}
            onMoveToGroup={onBoardMoveToGroup}
            onCreateStart={onCreateRow}
            onColumnAction={onColumnAction}
          />
        ) : (
          <DataRendererEmptyState
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
      <DataRendererList
        key={listKey}
        items={listItems}
        selectedItemId={selectedRowId}
        expandedGroups={listExpandedGroups}
        onExpandedGroupChange={onListExpandedGroupChange}
      />
    );
  }

  return <DataRendererEmptyState emptyState={emptyState} title={emptyTitle} description={emptyDescription} />;
};
