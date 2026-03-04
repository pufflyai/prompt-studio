import { Box, Text } from "ink";

import type { TicketFlatRow } from "../hooks/use-tickets";

interface TicketItemProps {
  row: TicketFlatRow & { type: "ticket" };
  isExpanded: boolean;
  isSelected: boolean;
  width: number;
}

export function TicketItem({ row, isExpanded, isSelected, width }: TicketItemProps) {
  const { ticket, depth, hasChildren } = row;

  const indent = "    ".repeat(depth);
  const marker = hasChildren ? (isExpanded ? "▾ " : "▸ ") : "  ";
  const selector = isSelected ? " ❯ " : "   ";
  const prefix = `${selector}${indent}${marker}`;

  const shorthand = ticket.shorthand.padEnd(10);
  const maxTitle = Math.max(0, width - prefix.length - 10 - 2);
  const title = ticket.title ?? "";
  const displayed = title.length > maxTitle ? `${title.slice(0, maxTitle - 1)}…` : title;

  if (isSelected) {
    return (
      <Box>
        <Text backgroundColor="blue" color="white" bold>
          {prefix}
          {shorthand}
          {displayed}
          {"".padEnd(Math.max(0, width - prefix.length - shorthand.length - displayed.length))}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>
        {prefix}
        <Text dimColor={ticket.draft}>{shorthand}</Text>
        {displayed}
      </Text>
    </Box>
  );
}
