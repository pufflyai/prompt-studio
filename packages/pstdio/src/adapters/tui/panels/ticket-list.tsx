import { Box, Text } from "ink";

import { StatusGroup } from "../components/status-group";
import { TicketItem } from "../components/ticket-item";
import type { TicketFlatRow } from "../hooks/use-tickets";

interface TicketListProps {
  rows: TicketFlatRow[];
  selectedIndex: number;
  expanded: Set<string>;
  viewportHeight: number;
  scrollOffset: number;
  width: number;
}

export function TicketList({ rows, selectedIndex, expanded, viewportHeight, scrollOffset, width }: TicketListProps) {
  if (rows.length === 0) {
    return (
      <Box height={viewportHeight} alignItems="center" justifyContent="center">
        <Text dimColor>No tickets found. Press n to create one.</Text>
      </Box>
    );
  }

  const visible = rows.slice(scrollOffset, scrollOffset + viewportHeight);
  const emptyLines = Math.max(0, viewportHeight - visible.length);

  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + viewportHeight < rows.length;

  return (
    <Box flexDirection="column" height={viewportHeight}>
      {showScrollUp && (
        <Box justifyContent="center">
          <Text dimColor>{`  ▲ ${scrollOffset} more`}</Text>
        </Box>
      )}

      {visible.map((row, i) => {
        const globalIndex = scrollOffset + i;

        if (row.type === "header") {
          return <StatusGroup key={`h-${row.statusName}`} name={row.statusName} width={width} />;
        }

        return (
          <TicketItem
            key={row.ticket.id}
            row={row}
            isExpanded={expanded.has(row.ticket.id)}
            isSelected={globalIndex === selectedIndex}
            width={width}
          />
        );
      })}

      {showScrollDown && (
        <Box justifyContent="center">
          <Text dimColor>{`  ▼ ${rows.length - scrollOffset - viewportHeight} more`}</Text>
        </Box>
      )}

      {emptyLines > 0 && <Box height={emptyLines} />}
    </Box>
  );
}
