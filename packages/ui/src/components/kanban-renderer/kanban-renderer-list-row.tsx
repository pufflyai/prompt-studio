import { Box, HStack, Icon, Text, Wrap } from "@chakra-ui/react";
import type { DragEvent } from "react";
import { HighlightedText } from "../collection-view/highlighted-text";
import { ListRow } from "../list-row/list-row";
import type { ListRowItem } from "../list-row/list-row.types";
import { KanbanRendererAttributeBadge } from "./kanban-renderer-attribute-badge";
import type { FlattenedKanbanRendererListItem, KanbanRendererListItem } from "./kanban-renderer-list";

const getDropTargetIndicatorProps = (isDropTarget: boolean, isGroup: boolean) => {
  if (!isDropTarget) return undefined;

  return {
    _before: {
      content: '""',
      position: "absolute",
      bg: "border.accent",
      left: "0",
      top: "0",
      width: isGroup ? "3px" : "100%",
      height: isGroup ? "100%" : "2px",
    },
  } as const;
};

interface KanbanRendererListItemContentProps {
  item: KanbanRendererListItem;
}

const KanbanRendererListLabel = (props: KanbanRendererListItemContentProps) => {
  const { item } = props;

  if (item.isGroup) {
    return (
      <HStack gap="xs" minW="0" maxW="full" flex="1">
        <Text textStyle="label/S/medium" minW="0" truncate>
          {item.title}
        </Text>
        <Text textStyle="label/XS" color="fg.muted" flexShrink={0}>
          {item.countBadge}
        </Text>
      </HStack>
    );
  }

  return (
    <HStack gap="compact" minW="0" maxW="full" flex="1">
      {item.eyebrow ? (
        <Text data-testid="list-row-eyebrow" flexShrink={0} textStyle="mono/XS" color="fg.muted" truncate>
          <HighlightedText text={item.eyebrow} query={item.highlight ?? ""} />
        </Text>
      ) : null}
      <Text textStyle="paragraph/S/regular" minW="0" truncate>
        <HighlightedText text={item.title} query={item.highlight ?? ""} />
      </Text>
    </HStack>
  );
};

const KanbanRendererListBadges = (props: KanbanRendererListItemContentProps) => {
  const { item } = props;

  return (
    <HStack gap="xs" flexShrink={0}>
      <Wrap gap="2xs" flexShrink={0}>
        {item.badges?.map((badge) => (
          <KanbanRendererAttributeBadge key={badge.attributeId} badge={badge} onChange={item.onBadgeChange} />
        ))}
        {item.customSlots}
      </Wrap>
    </HStack>
  );
};

// ListRow only reserves end space when endContent is set, so rows without badges pass null.
const hasEndContent = (item: KanbanRendererListItem) =>
  (item.badges?.length ?? 0) > 0 || (item.customSlots?.length ?? 0) > 0;

const buildListRowItem = (item: KanbanRendererListItem, hasChildren: boolean): ListRowItem => ({
  id: item.id,
  label: <KanbanRendererListLabel item={item} />,
  icon: item.statusIcon ? (
    <Icon
      data-testid={item.isGroup ? "list-status-icon" : "row-status-icon"}
      as={item.statusIcon}
      boxSize="1rem"
      colorPalette={item.statusColorPalette ?? item.countColorPalette ?? "gray"}
      color={item.statusColor ?? (item.isGroup || item.statusColorPalette ? "colorPalette.solid" : "fg.muted")}
    />
  ) : undefined,
  endContent: hasEndContent(item) ? <KanbanRendererListBadges item={item} /> : null,
  isContainer: hasChildren,
  contextMenuItems: item.contextMenuActions?.map((action) => ({
    id: action.key,
    label: action.label,
    icon: action.icon ?? undefined,
    disabled: action.isDisabled,
    separatorBefore: action.separatorBefore,
    endContent: action.endContent,
    onAction: action.onClick,
  })),
});

interface KanbanRendererListRowProps {
  row: FlattenedKanbanRendererListItem;
  isExpanded: boolean;
  selectedItemId: string | null;
  activeDropTargetId: string | null;
  draggedItemId: string | null;
  onDraggedItemChange: (itemId: string | null) => void;
  onDropTargetChange: (itemId: string | null) => void;
  onExpandedChange: (rowId: string, isExpanded: boolean) => void;
  onItemClick?: (item: KanbanRendererListItem) => void;
}

export const KanbanRendererListRow = (props: KanbanRendererListRowProps) => {
  const {
    row,
    isExpanded,
    selectedItemId,
    activeDropTargetId,
    draggedItemId,
    onDraggedItemChange,
    onDropTargetChange,
    onItemClick,
    onExpandedChange,
  } = props;
  const { item, isGroup, canExpand } = row;
  const isSelected = item.id === selectedItemId;
  const canDropHere = Boolean(item.onDropRow) && item.id !== draggedItemId;
  const isDropTarget = canDropHere && item.id === activeDropTargetId;
  const rowItem = buildListRowItem(item, canExpand);
  const toggleExpanded = () => onExpandedChange(row.id, !isExpanded);

  const handleActivate = () => {
    if (canExpand) {
      toggleExpanded();
      return;
    }
    if (isGroup) return;
    item.onClick?.();
    onItemClick?.(item);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!item.draggable) return;
    event.stopPropagation();
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
    onDraggedItemChange(item.id);
    onDropTargetChange(null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canDropHere) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    onDropTargetChange(item.id);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    onDropTargetChange(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canDropHere || !item.onDropRow) return;
    event.preventDefault();
    event.stopPropagation();
    onDropTargetChange(null);
    onDraggedItemChange(null);
    const draggedId = event.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === item.id) return;
    item.onDropRow(draggedId);
  };

  const handleDragEnd = () => {
    onDropTargetChange(null);
    onDraggedItemChange(null);
  };

  return (
    <Box
      data-drop-target={isDropTarget ? "true" : undefined}
      position="relative"
      borderBottomWidth="1px"
      borderBottomColor="border.subtle"
      bg={isDropTarget ? "bg.subtle" : "transparent"}
      draggable={item.draggable}
      transition="background 120ms ease"
      {...getDropTargetIndicatorProps(isDropTarget, canExpand)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={item.onDropRow ? handleDragLeave : undefined}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
    >
      <ListRow
        {...rowItem}
        aria-label={isGroup ? undefined : item.title}
        variant={isGroup ? "compact" : "collection"}
        depth={row.depth}
        isSelected={isSelected}
        isExpanded={isExpanded}
        showExpandToggle={canExpand}
        showContextMenuTrigger={false}
        onActivate={handleActivate}
        onToggleExpand={toggleExpanded}
      />
    </Box>
  );
};
