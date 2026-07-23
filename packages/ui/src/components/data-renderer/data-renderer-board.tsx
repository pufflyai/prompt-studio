import { Box, Stack } from "@chakra-ui/react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { ColumnHeader } from "./data-renderer-board-column-header";
import { GroupSection } from "./data-renderer-board-group-section";
import { DataRendererCard } from "./data-renderer-card";

type DataRendererCardProps = ComponentProps<typeof DataRendererCard>;

export interface DataRendererBoardItem {
  id: string;
  cardProps: Omit<DataRendererCardProps, "draggable" | "onDragStart" | "onDragEnd" | "isSelected">;
  contextMenuActions?: ResourceContextAction[];
}

export interface DataRendererBoardColumnAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}

export interface DataRendererBoardGroup {
  key: string;
  label: string;
  items: DataRendererBoardItem[];
}

export interface DataRendererBoardColumn {
  id: string;
  label: string;
  createLabel?: string;
  color?: string;
  items: DataRendererBoardItem[];
  groups?: DataRendererBoardGroup[];
  canDragIn: boolean;
  canDragOut: boolean;
  canCreate: boolean;
  actions: DataRendererBoardColumnAction[];
}

interface DataRendererBoardProps {
  columns: DataRendererBoardColumn[];
  selectedItemId?: string | null;
  onMoveItem?: (
    itemId: string,
    targetColumnId: string,
    context?: { beforeItemId?: string; targetGroupKey?: string },
  ) => Promise<void> | void;
  onMoveToGroup?: (itemId: string, targetGroupKey: string, context?: { beforeItemId?: string }) => Promise<void> | void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const DataRendererBoard = (props: DataRendererBoardProps) => {
  const { columns, selectedItemId = null, onMoveItem, onMoveToGroup, onCreateStart, onColumnAction } = props;

  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const handleDragStart = (itemId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setActiveColumn(null);
    setActiveGroup(null);
  };

  const handleDragOver = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveColumn(columnId);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setActiveColumn(null);
  };

  const handleDrop = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveColumn(null);

    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;

    onMoveItem?.(itemId, columnId);
  };

  return (
    <ScrollArea
      height="100%"
      size="xs"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      contentProps={{ display: "flex", alignItems: "stretch", gap: "0", pb: "2xs", minH: "100%" }}
    >
      {columns.map((column) => (
        <Stack
          key={column.id}
          data-testid={`board-column-${column.id}`}
          gap="0"
          _notFirst={{ borderLeft: "1px solid", borderColor: "border.subtle" }}
          background={activeColumn === column.id ? "bg.subtle" : "bg"}
          transition="background 150ms ease"
          height="100%"
          minH="240px"
          overflow="hidden"
          minW="260px"
          flex="1 0 260px"
          onDragOver={column.canDragIn ? handleDragOver(column.id) : undefined}
          onDragLeave={column.canDragIn ? handleDragLeave : undefined}
          onDrop={column.canDragIn ? handleDrop(column.id) : undefined}
        >
          <ColumnHeader column={column} onCreateStart={onCreateStart} onColumnAction={onColumnAction} />

          <ScrollArea
            flex="1"
            minH="0"
            size="xs"
            verticalScrollbarProps={{ margin: "0" }}
            contentProps={{
              spaceY: "sm",
              ps: "xs",
              pe: "xs",
            }}
          >
            {column.groups && column.groups.length > 0
              ? column.groups.map((group) => {
                  const groupId = `${column.id}::${group.key}`;
                  return (
                    <GroupSection
                      key={group.key}
                      columnId={column.id}
                      group={group}
                      selectedItemId={selectedItemId}
                      canDragIn={column.canDragIn}
                      canDragOut={column.canDragOut}
                      isDropTarget={activeGroup === groupId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onGroupDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        setActiveGroup(groupId);
                        setActiveColumn(null);
                      }}
                      onGroupDragLeave={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                        setActiveGroup(null);
                      }}
                      onGroupDrop={(event, beforeItemId) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setActiveGroup(null);
                        setActiveColumn(null);
                        const itemId = event.dataTransfer.getData("text/plain");
                        if (!itemId) return;
                        if (onMoveItem) {
                          onMoveItem(itemId, column.id, { beforeItemId, targetGroupKey: group.key });
                          return;
                        }
                        onMoveToGroup?.(itemId, group.key, { beforeItemId });
                      }}
                    />
                  );
                })
              : column.items.map((item) => (
                  <ResourceContextMenu key={item.id} actions={item.contextMenuActions ?? []}>
                    <Box
                      onDragOver={
                        column.canDragIn
                          ? (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.dataTransfer.dropEffect = "move";
                              setActiveColumn(column.id);
                            }
                          : undefined
                      }
                      onDrop={
                        column.canDragIn
                          ? (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setActiveColumn(null);
                              const itemId = event.dataTransfer.getData("text/plain");
                              if (!itemId || itemId === item.id) return;
                              onMoveItem?.(itemId, column.id, { beforeItemId: item.id });
                            }
                          : undefined
                      }
                    >
                      <DataRendererCard
                        {...item.cardProps}
                        contextMenuActions={item.contextMenuActions}
                        isSelected={item.id === selectedItemId}
                        draggable={column.canDragOut}
                        onDragStart={column.canDragOut ? handleDragStart(item.id) : undefined}
                        onDragEnd={column.canDragOut ? handleDragEnd : undefined}
                      />
                    </Box>
                  </ResourceContextMenu>
                ))}
          </ScrollArea>
        </Stack>
      ))}
    </ScrollArea>
  );
};
