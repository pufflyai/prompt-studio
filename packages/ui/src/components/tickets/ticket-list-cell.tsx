import { Badge, Box, HStack, Icon, Text, Wrap } from "@chakra-ui/react";
import type { Row } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import type { TicketListItem } from "./ticket-list";

interface TicketCellProps {
  row: Row<TicketListItem>;
}

export const TicketCell = (props: TicketCellProps) => {
  const { row } = props;
  const item = row.original;
  const depth = row.depth;
  const hasTicketId = item.ticketId.trim().length > 0;

  return (
    <HStack gap="2xs" flex="1" paddingLeft={depth > 0 ? `${depth * 24}px` : undefined}>
      {row.getCanExpand() ? <ExpandToggle row={row} /> : depth > 0 ? <TreeConnector /> : null}

      {item.statusIcon && (
        <Icon as={item.statusIcon} boxSize="16px" color={item.statusColor ?? "fg.muted"} flexShrink={0} />
      )}

      {hasTicketId ? (
        <Text textStyle="label/S/regular" flexShrink={0} minW="70px">
          {item.ticketId}
        </Text>
      ) : null}

      <Text textStyle="label/S/regular" flex="1" truncate>
        {item.title}
      </Text>

      {item.badges && item.badges.length > 0 && (
        <Wrap gap="2xs" flexShrink={0}>
          {item.badges.map((badge, index) => (
            <Badge
              key={badge.id ?? `${badge.label}-${index}`}
              variant="subtle"
              colorPalette={badge.color ?? "gray"}
              textStyle="label/XS/medium"
              cursor={badge.onClick ? "pointer" : undefined}
              _hover={badge.onClick ? { opacity: 0.8 } : undefined}
              role={badge.onClick ? "button" : undefined}
              tabIndex={badge.onClick ? 0 : undefined}
              onClick={
                badge.onClick
                  ? (event: MouseEvent) => {
                      event.stopPropagation();
                      badge.onClick?.();
                    }
                  : undefined
              }
              onKeyDown={
                badge.onClick
                  ? (event: KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        badge.onClick?.();
                      }
                    }
                  : undefined
              }
            >
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
      cursor="pointer"
      data-expanded={isExpanded ? "true" : undefined}
      aria-label={isExpanded ? "Collapse group" : "Expand group"}
      role="button"
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        row.toggleExpanded();
      }}
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
