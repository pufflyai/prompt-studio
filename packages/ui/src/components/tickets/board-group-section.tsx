import { Badge, Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { type DragEvent, useState } from "react";

import { getIconComponent } from "./tag-icons";
import type { TicketBoardGroup } from "./ticket-board";
import { TicketCard } from "./ticket-card";

interface BoardGroupSectionProps {
  group: TicketBoardGroup;
  selectedItemId: string | null;
  canDragIn: boolean;
  canDragOut: boolean;
  isDropTarget: boolean;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onGroupDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDrop: (event: DragEvent<HTMLDivElement>) => void;
}

export const BoardGroupSection = (props: BoardGroupSectionProps) => {
  const {
    group,
    selectedItemId,
    canDragIn,
    canDragOut,
    isDropTarget,
    onDragStart,
    onDragEnd,
    onGroupDragOver,
    onGroupDragLeave,
    onGroupDrop,
  } = props;
  const [expanded, setExpanded] = useState(true);

  return (
    <Stack
      gap="0"
      borderRadius="sm"
      background={isDropTarget ? "bg.subtle" : "transparent"}
      transition="background 150ms ease"
      onDragOver={canDragIn ? onGroupDragOver : undefined}
      onDragLeave={canDragIn ? onGroupDragLeave : undefined}
      onDrop={canDragIn ? onGroupDrop : undefined}
    >
      <HStack
        px="xs"
        py="2xs"
        gap="2xs"
        cursor="pointer"
        _hover={{ bg: "bg.hover" }}
        borderRadius="sm"
        onClick={() => setExpanded((v) => !v)}
      >
        <Box display="flex" alignItems="center" flexShrink={0}>
          <Icon
            as={ChevronRight}
            boxSize="14px"
            color="fg.muted"
            transform={expanded ? "rotate(90deg)" : "rotate(0deg)"}
            transition="transform 0.15s ease"
          />
        </Box>
        {group.icon && <Icon as={getIconComponent(group.icon)} boxSize="12px" color={`${group.color ?? "gray"}.500`} />}
        <Text textStyle="label/S/medium" color="fg.muted">
          {group.label}
        </Text>
        <Badge variant="subtle" colorPalette="gray" size="sm">
          {group.items.length}
        </Badge>
      </HStack>
      {expanded && (
        <Stack gap="sm" pt="xs">
          {group.items.map((item) => (
            <TicketCard
              key={item.id}
              {...item.cardProps}
              isSelected={item.id === selectedItemId}
              draggable={canDragOut}
              onDragStart={canDragOut ? onDragStart(item.id) : undefined}
              onDragEnd={canDragOut ? onDragEnd : undefined}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export type { BoardGroupSectionProps };
