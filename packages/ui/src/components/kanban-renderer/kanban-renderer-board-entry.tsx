import { Badge, Box, HStack, Icon, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import type { DragEvent, KeyboardEvent } from "react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import type { KanbanRendererBoardGroup, KanbanRendererBoardItem } from "./kanban-renderer-board";
import { KanbanRendererCard } from "./kanban-renderer-card";

export interface BoardEntryData {
  key: string;
  group?: KanbanRendererBoardGroup;
  item?: KanbanRendererBoardItem;
  groupKey?: string;
}
interface BoardEntryProps {
  entry: BoardEntryData;
  index: number;
  selectedItemId: string | null;
  collapsed: boolean;
  dropTarget: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onKeyboard: (event: KeyboardEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}
export const BoardEntry = (props: BoardEntryProps) => {
  const {
    entry,
    index,
    selectedItemId,
    collapsed,
    dropTarget,
    canDragIn,
    canDragOut,
    onToggle,
    onFocus,
    onKeyboard,
    onDragOver,
    onDrop,
    onDragStart,
    onDragEnd,
  } = props;
  const { item, group } = entry;
  if (group)
    return (
      <HStack
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        data-board-key={entry.key}
        data-board-pan-ignore
        px="xs"
        py="2xs"
        gap="2xs"
        cursor="pointer"
        borderRadius="sm"
        bg={dropTarget ? "bg.subtle" : "transparent"}
        _hover={{ bg: "bg.hover" }}
        onFocus={onFocus}
        onClick={onToggle}
        onKeyDown={(event) => {
          onKeyboard(event, index);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        onDragOver={canDragIn ? onDragOver : undefined}
        onDrop={canDragIn ? onDrop : undefined}
      >
        <Icon
          as={ChevronRight}
          boxSize="14px"
          color="fg.muted"
          transform={collapsed ? "rotate(0deg)" : "rotate(90deg)"}
        />
        <Text textStyle="label/S/medium" color="fg.muted">
          {group.label}
        </Text>
        <Badge variant="number" colorPalette="gray" size="sm">
          {group.items.length}
        </Badge>
      </HStack>
    );
  if (!item) return null;
  return (
    <ResourceContextMenu actions={item.contextMenuActions ?? []}>
      <Box
        data-board-key={item.id}
        tabIndex={0}
        role="button"
        aria-label={item.cardProps.title}
        onFocusCapture={onFocus}
        onKeyDown={(event) => {
          onKeyboard(event, index);
          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            item.cardProps.onClick?.();
          }
        }}
        onDragOver={canDragIn ? onDragOver : undefined}
        onDrop={canDragIn ? onDrop : undefined}
      >
        <KanbanRendererCard
          {...item.cardProps}
          isSelected={item.id === selectedItemId}
          draggable={canDragOut}
          onDragStart={canDragOut ? onDragStart(item.id) : undefined}
          onDragEnd={canDragOut ? onDragEnd : undefined}
        />
      </Box>
    </ResourceContextMenu>
  );
};
