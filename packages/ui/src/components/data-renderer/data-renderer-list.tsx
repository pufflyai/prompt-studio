import { Badge, Box, HStack, Icon, Text, Wrap } from "@chakra-ui/react";
import {
  type ColumnDef,
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { type ComponentType, type ReactNode, useState } from "react";
import { ListRow } from "../list-row/list-row";
import type { ListRowItem } from "../list-row/list-row.types";
import type { ResourceContextAction } from "../resource-context-menu";
import type { AttributeBadge } from "./data-renderer-helpers";

export interface DataRendererListItem {
  id: string;
  title: string;
  countBadge?: number;
  statusIcon?: ComponentType<{ size?: number | string }>;
  statusColor?: string;
  badges?: AttributeBadge[];
  customSlots?: ReactNode[];
  children?: DataRendererListItem[];
  onClick?: () => void;
  contextMenuActions?: ResourceContextAction[];
  draggable?: boolean;
  onDropRow?: (rowId: string) => void;
}

interface DataRendererListProps {
  items: DataRendererListItem[];
  selectedItemId?: string | null;
  onItemClick?: (item: DataRendererListItem) => void;
}

const INDENT_STEP_PX = 12;

export const getDataRendererListIndentation = (depth: number) => {
  if (depth <= 0) return undefined;
  return `${depth * INDENT_STEP_PX}px`;
};

const columns: ColumnDef<DataRendererListItem, unknown>[] = [{ id: "row" }];

const renderLabel = (item: DataRendererListItem) => (
  <HStack gap="xs" minW="0" flex="1">
    <Text textStyle="label/S/regular" flex="1" truncate>
      {item.title}
    </Text>
  </HStack>
);

const renderEndContent = (item: DataRendererListItem) => {
  const hasBadges = (item.badges?.length ?? 0) > 0 || (item.customSlots?.length ?? 0) > 0;
  const hasCount = typeof item.countBadge === "number";

  if (!hasBadges && !hasCount) return null;

  return (
    <HStack gap="xs" flexShrink={0}>
      {hasCount ? (
        <Badge variant="subtle" colorPalette="gray" size="sm" flexShrink={0}>
          {item.countBadge}
        </Badge>
      ) : null}
      {hasBadges ? (
        <Wrap gap="2xs" flexShrink={0}>
          {item.badges?.map((badge) => (
            <Badge
              key={badge.attributeId}
              variant="subtle"
              colorPalette={badge.color ?? "gray"}
              textStyle="label/XS/medium"
            >
              {badge.label}
            </Badge>
          ))}
          {item.customSlots}
        </Wrap>
      ) : null}
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
    onAction: action.onClick,
  })),
});

export const DataRendererList = (props: DataRendererListProps) => {
  const { items, selectedItemId = null, onItemClick } = props;
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  const table = useReactTable({
    data: items,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <Box>
      {table.getRowModel().rows.map((row) => (
        <DataRendererListRow key={row.id} row={row} selectedItemId={selectedItemId} onItemClick={onItemClick} />
      ))}
    </Box>
  );
};

interface DataRendererListRowProps {
  row: Row<DataRendererListItem>;
  selectedItemId: string | null;
  onItemClick?: (item: DataRendererListItem) => void;
}

const DataRendererListRow = (props: DataRendererListRowProps) => {
  const { row, selectedItemId, onItemClick } = props;
  const item = row.original;
  const canExpand = row.getCanExpand();
  const isSelected = item.id === selectedItemId;
  const rowItem = buildListRowItem(item, canExpand);

  const handleActivate = () => {
    if (canExpand) {
      row.toggleExpanded();
      return;
    }
    item.onClick?.();
    onItemClick?.(item);
  };

  return (
    <Box
      borderBottomWidth="1px"
      borderColor="border.muted"
      draggable={item.draggable}
      onDragStart={(event) => {
        if (!item.draggable) return;
        event.stopPropagation();
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!item.onDropRow) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!item.onDropRow) return;
        event.preventDefault();
        event.stopPropagation();
        const draggedId = event.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === item.id) return;
        item.onDropRow(draggedId);
      }}
    >
      <ListRow
        {...rowItem}
        variant="tree"
        depth={row.depth}
        isSelected={isSelected}
        isExpanded={row.getIsExpanded()}
        showExpandToggle={canExpand}
        onActivate={handleActivate}
        onToggleExpand={() => row.toggleExpanded()}
      />
    </Box>
  );
};
