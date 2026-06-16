import { Badge, Box, HStack, Icon, Text, Wrap } from "@chakra-ui/react";
import { type ComponentType, type DragEvent, type ReactNode, useState } from "react";
import { ListRow } from "../list-row/list-row";
import type { ListRowItem } from "../list-row/list-row.types";
import type { ResourceContextAction } from "../resource-context-menu";
import { DataRendererAttributeBadge } from "./data-renderer-attribute-badge";
import type { AttributeBadge } from "./data-renderer-helpers";

export interface DataRendererListItem {
  id: string;
  title: string;
  countBadge?: number;
  countColorPalette?: string;
  statusIcon?: ComponentType<{ size?: number | string }>;
  statusColor?: string;
  badges?: AttributeBadge[];
  customSlots?: ReactNode[];
  children?: DataRendererListItem[];
  onClick?: () => void;
  onBadgeChange?: (attributeId: string, value: unknown) => void;
  contextMenuActions?: ResourceContextAction[];
  draggable?: boolean;
  onDropRow?: (rowId: string) => void;
}

export type DataRendererListExpandedState = Record<string, boolean>;

export interface DataRendererListProps {
  items: DataRendererListItem[];
  selectedItemId?: string | null;
  expandedGroups?: DataRendererListExpandedState;
  onItemClick?: (item: DataRendererListItem) => void;
  onExpandedGroupChange?: (rowId: string, isExpanded: boolean) => void;
}

const INDENT_STEP_PX = 12;

interface FlattenedDataRendererListItem {
  id: string;
  item: DataRendererListItem;
  depth: number;
  canExpand: boolean;
}

export const getDataRendererListIndentation = (depth: number) => {
  if (depth <= 0) return undefined;
  return `${depth * INDENT_STEP_PX}px`;
};

export const flattenDataRendererListItems = (
  items: DataRendererListItem[],
  expanded: DataRendererListExpandedState,
  depth = 0,
) => {
  const rows: FlattenedDataRendererListItem[] = [];

  for (const item of items) {
    const canExpand = (item.children?.length ?? 0) > 0;
    rows.push({ id: item.id, item, depth, canExpand });

    if (canExpand && getRowIsExpanded(expanded, item.id)) {
      rows.push(...flattenDataRendererListItems(item.children ?? [], expanded, depth + 1));
    }
  }

  return rows;
};

const getDropTargetBoxShadow = (isDropTarget: boolean, isGroup: boolean) => {
  if (!isDropTarget) return undefined;
  if (isGroup) return "inset 3px 0 0 var(--chakra-colors-border-accent)";
  return "inset 0 2px 0 var(--chakra-colors-border-accent)";
};

const getRowIsExpanded = (expandedState: DataRendererListExpandedState, rowId: string) => {
  return expandedState[rowId] !== false;
};

const updateExpandedState = (expandedState: DataRendererListExpandedState, rowId: string, isExpanded: boolean) => {
  return { ...expandedState, [rowId]: isExpanded };
};

const renderLabel = (item: DataRendererListItem) => (
  <HStack gap="xs" minW="0" maxW="full" flex="1">
    <Text textStyle="label/S/regular" minW="0" truncate>
      {item.title}
    </Text>
    {typeof item.countBadge === "number" ? (
      <Badge
        variant="subtle"
        size="sm"
        flexShrink={0}
        {...(item.countColorPalette ? { colorPalette: item.countColorPalette } : { bg: "bg.muted", color: "fg.muted" })}
      >
        {item.countBadge}
      </Badge>
    ) : null}
  </HStack>
);

const renderEndContent = (item: DataRendererListItem) => {
  const hasBadges = (item.badges?.length ?? 0) > 0 || (item.customSlots?.length ?? 0) > 0;

  if (!hasBadges) return null;

  return (
    <HStack gap="xs" flexShrink={0}>
      <Wrap gap="2xs" flexShrink={0}>
        {item.badges?.map((badge) => (
          <DataRendererAttributeBadge key={badge.attributeId} badge={badge} onChange={item.onBadgeChange} />
        ))}
        {item.customSlots}
      </Wrap>
    </HStack>
  );
};

const buildListRowItem = (item: DataRendererListItem, hasChildren: boolean): ListRowItem => ({
  id: item.id,
  label: renderLabel(item),
  icon: item.statusIcon ? <Icon as={item.statusIcon} boxSize="16px" /> : undefined,
  iconColor: item.statusColor ?? "fg.muted",
  endContent: renderEndContent(item),
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

export const DataRendererList = (props: DataRendererListProps) => {
  const { items, selectedItemId = null, expandedGroups, onItemClick, onExpandedGroupChange } = props;
  const [localExpandedGroups, setLocalExpandedGroups] = useState<DataRendererListExpandedState>({});
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const expanded = expandedGroups ?? localExpandedGroups;
  const rows = flattenDataRendererListItems(items, expanded);

  const handleExpandedChange = (rowId: string, isExpanded: boolean) => {
    onExpandedGroupChange?.(rowId, isExpanded);
    if (expandedGroups === undefined) {
      setLocalExpandedGroups((current) => updateExpandedState(current, rowId, isExpanded));
    }
  };

  return (
    <Box>
      {rows.map((row) => (
        <DataRendererListRow
          key={row.id}
          row={row}
          isExpanded={getRowIsExpanded(expanded, row.id)}
          selectedItemId={selectedItemId}
          activeDropTargetId={activeDropTargetId}
          draggedItemId={draggedItemId}
          onDraggedItemChange={setDraggedItemId}
          onDropTargetChange={setActiveDropTargetId}
          onItemClick={onItemClick}
          onExpandedChange={handleExpandedChange}
        />
      ))}
    </Box>
  );
};

interface DataRendererListRowProps {
  row: FlattenedDataRendererListItem;
  isExpanded: boolean;
  selectedItemId: string | null;
  activeDropTargetId: string | null;
  draggedItemId: string | null;
  onDraggedItemChange: (itemId: string | null) => void;
  onDropTargetChange: (itemId: string | null) => void;
  onExpandedChange: (rowId: string, isExpanded: boolean) => void;
  onItemClick?: (item: DataRendererListItem) => void;
}

const DataRendererListRow = (props: DataRendererListRowProps) => {
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
  const { item, canExpand } = row;
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
      borderBottomWidth="1px"
      borderColor="border.muted"
      bg={isDropTarget ? "bg.subtle" : "transparent"}
      boxShadow={getDropTargetBoxShadow(isDropTarget, canExpand)}
      draggable={item.draggable}
      transition="background 120ms ease, box-shadow 120ms ease"
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={item.onDropRow ? handleDragLeave : undefined}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
    >
      <ListRow
        {...rowItem}
        variant="tree"
        depth={row.depth}
        isSelected={isSelected}
        isExpanded={isExpanded}
        showExpandToggle={canExpand}
        onActivate={handleActivate}
        onToggleExpand={toggleExpanded}
      />
    </Box>
  );
};
