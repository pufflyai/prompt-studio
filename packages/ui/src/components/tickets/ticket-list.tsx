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

import type { TicketCardBadge } from "./ticket-card";

export interface TicketListItem {
  id: string;
  ticketId: string;
  title: string;
  statusIcon?: ComponentType<{ size?: number | string }>;
  statusColor?: string;
  badges?: TicketCardBadge[];
  date?: string;
  assigneeIcon?: ReactNode;
  children?: TicketListItem[];
  onClick?: () => void;
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
          <HStack
            key={row.id}
            paddingX="sm"
            paddingY="xs"
            gap="sm"
            cursor="pointer"
            borderBottomWidth="1px"
            borderColor="border.muted"
            background={isSelected ? "bg.muted" : "transparent"}
            _hover={{ background: "bg.muted" }}
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

  return (
    <HStack gap="sm" flex="1" paddingLeft={depth > 0 ? `${depth * 24}px` : undefined}>
      {row.getCanExpand() ? <ExpandToggle row={row} /> : depth > 0 ? <TreeConnector /> : null}

      {item.statusIcon && (
        <Icon as={item.statusIcon} boxSize="16px" color={item.statusColor ?? "fg.muted"} flexShrink={0} />
      )}

      <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0} minW="70px">
        {item.ticketId}
      </Text>

      <Text textStyle="label/S/regular" flex="1" truncate>
        {item.title}
      </Text>

      {item.badges && item.badges.length > 0 && (
        <Wrap gap="2xs" flexShrink={0}>
          {item.badges.map((badge) => (
            <Badge key={badge.label} variant="subtle" colorPalette={badge.color ?? "gray"} textStyle="label/XS/medium">
              {badge.label}
            </Badge>
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
      <ChevronRight
        size={14}
        style={{
          color: "var(--chakra-colors-fg-muted)",
          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s ease",
        }}
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
