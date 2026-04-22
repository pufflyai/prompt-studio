import { Badge, Box, HStack, Icon, Text, Wrap } from "@chakra-ui/react";
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { type ComponentType, type ReactNode, useState } from "react";
import type { ResourceContextAction } from "../resource-context-menu";
import { ResourceContextMenu } from "../resource-context-menu";
import { TagBadge } from "./tag-badge";
import type { TicketCardBadge, TicketCardTagBadge } from "./ticket-card";

export interface TicketListItem {
  id: string;
  ticketId: string;
  title: string;
  countBadge?: number;
  statusIcon?: ComponentType<{ size?: number | string }>;
  statusColor?: string;
  badges?: TicketCardBadge[];
  tagBadges?: TicketCardTagBadge[];
  date?: string;
  assigneeIcon?: ReactNode;
  children?: TicketListItem[];
  onClick?: () => void;
  onTagChange?: (tagName: string, newValue: string) => void;
  contextMenuActions?: ResourceContextAction[];
}

interface TicketListProps {
  items: TicketListItem[];
  selectedItemId?: string | null;
  onItemClick?: (item: TicketListItem) => void;
}

const columns: ColumnDef<TicketListItem, unknown>[] = [
  {
    id: "ticket",
    header: "",
    cell: ({ row }) => <TicketCell row={row} />,
  },
];

export const TicketList = (props: TicketListProps) => {
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
      {table.getRowModel().rows.map((row) => {
        const item = row.original;
        const isSelected = item.id === selectedItemId;
        const canExpand = row.getCanExpand();

        return (
          <ResourceContextMenu key={row.id} actions={item.contextMenuActions ?? []}>
            <HStack
              paddingX="sm"
              paddingY="xs"
              gap="sm"
              cursor="pointer"
              borderBottomWidth="1px"
              borderColor="border.muted"
              background={isSelected ? "bg.active" : "transparent"}
              _hover={{ background: isSelected ? "bg.active" : "bg.hover" }}
              onClick={() => {
                if (canExpand) {
                  row.toggleExpanded();
                } else {
                  item.onClick?.();
                  onItemClick?.(item);
                }
              }}
              data-selected={isSelected ? "true" : undefined}
            >
              {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
            </HStack>
          </ResourceContextMenu>
        );
      })}
    </Box>
  );
};

interface TicketCellProps {
  row: Row<TicketListItem>;
}

const TicketCell = (props: TicketCellProps) => {
  const { row } = props;
  const item = row.original;
  const depth = row.depth;
  const hasTicketId = item.ticketId.trim().length > 0;

  return (
    <HStack gap="xs" flex="1" paddingLeft={depth > 0 ? `${depth * 24}px` : undefined}>
      {row.getCanExpand() ? <ExpandToggle row={row} /> : depth > 0 ? <TreeConnector /> : null}

      {item.statusIcon && (
        <Icon as={item.statusIcon} boxSize="16px" color={item.statusColor ?? "fg.muted"} flexShrink={0} />
      )}

      {hasTicketId && (
        <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0} minW="70px">
          {item.ticketId}
        </Text>
      )}

      <Text textStyle="label/S/regular" flex="1" truncate>
        {item.title}
      </Text>

      {typeof item.countBadge === "number" && (
        <Badge variant="subtle" colorPalette="gray" size="sm" flexShrink={0}>
          {item.countBadge}
        </Badge>
      )}

      {((item.badges && item.badges.length > 0) || (item.tagBadges && item.tagBadges.length > 0)) && (
        <Wrap gap="2xs" flexShrink={0}>
          {item.badges?.map((badge) => (
            <Badge key={badge.label} variant="subtle" colorPalette={badge.color ?? "gray"} textStyle="label/XS/medium">
              {badge.label}
            </Badge>
          ))}
          {item.tagBadges?.map((tag) => (
            <TagBadge
              key={tag.tagName}
              value={tag.value}
              label={tag.label}
              color={tag.value ? tag.color : "gray"}
              options={tag.options}
              onValueChange={item.onTagChange ? (newValue) => item.onTagChange!(tag.tagName, newValue) : undefined}
            />
          ))}
        </Wrap>
      )}

      {item.assigneeIcon && <Box flexShrink={0}>{item.assigneeIcon}</Box>}

      {item.date && (
        <Text textStyle="label/XS/regular" color="fg.muted" flexShrink={0}>
          {item.date}
        </Text>
      )}
    </HStack>
  );
};

interface ExpandToggleProps {
  row: Row<TicketListItem>;
}

const ExpandToggle = (props: ExpandToggleProps) => {
  const { row } = props;
  const isExpanded = row.getIsExpanded();

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      width="16px"
      height="16px"
      data-expanded={isExpanded ? "true" : undefined}
      aria-label={isExpanded ? "Collapse group" : "Expand group"}
    >
      <Icon
        as={ChevronRight}
        boxSize="14px"
        color="fg.muted"
        transform={isExpanded ? "rotate(90deg)" : "rotate(0deg)"}
        transition="transform 0.15s ease"
      />
    </Box>
  );
};

const TreeConnector = () => (
  <Box width="16px" height="16px" position="relative" flexShrink={0}>
    <Box position="absolute" left="7px" top="0" bottom="50%" borderLeftWidth="1px" borderColor="border.muted" />
    <Box position="absolute" left="7px" top="50%" width="8px" borderBottomWidth="1px" borderColor="border.muted" />
  </Box>
);
