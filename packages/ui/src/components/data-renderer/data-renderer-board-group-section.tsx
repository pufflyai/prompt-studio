import { Badge, Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { type DragEvent, useState } from "react";

import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import type { DataRendererBoardGroup } from "./data-renderer-board";
import { DataRendererCard } from "./data-renderer-card";

interface GroupSectionProps {
  columnId: string;
  group: DataRendererBoardGroup;
  selectedItemId: string | null;
  canDragIn: boolean;
  canDragOut: boolean;
  isDropTarget: boolean;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onGroupDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDrop: (event: DragEvent<HTMLDivElement>, beforeItemId?: string) => void;
}

export const GroupSection = (props: GroupSectionProps) => {
  const {
    columnId,
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
      data-column-id={columnId}
      data-group-key={group.key}
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
        onClick={() => setExpanded((value) => !value)}
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
        <Text textStyle="label/S/medium" color="fg.muted">
          {group.label}
        </Text>
        <Badge variant="number" colorPalette="gray" size="sm">
          {group.items.length}
        </Badge>
      </HStack>
      {expanded && (
        <Stack gap="sm" pt="xs">
          {group.items.map((item) => (
            <ResourceContextMenu key={item.id} actions={item.contextMenuActions ?? []}>
              <Box
                onDragOver={
                  canDragIn
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                      }
                    : undefined
                }
                onDrop={
                  canDragIn
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const itemId = event.dataTransfer.getData("text/plain");
                        if (!itemId || itemId === item.id) return;
                        onGroupDrop(event, item.id);
                      }
                    : undefined
                }
              >
                <DataRendererCard
                  {...item.cardProps}
                  isSelected={item.id === selectedItemId}
                  draggable={canDragOut}
                  onDragStart={canDragOut ? onDragStart(item.id) : undefined}
                  onDragEnd={canDragOut ? onDragEnd : undefined}
                />
              </Box>
            </ResourceContextMenu>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
