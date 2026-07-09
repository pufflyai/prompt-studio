import { Badge, Box, Icon as ChakraIcon, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { type DragEvent, useState } from "react";
import type { QueuedFollowUp } from "./message-types";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";

interface QueuedFollowUpListProps {
  items: QueuedFollowUp[];
  editingItemId?: string | null;
  onEdit?: (item: QueuedFollowUp) => void;
  onRemove?: (itemId: string) => void;
  onMove?: (itemId: string, direction: QueuedFollowUpMoveDirection, steps?: number) => void;
}

interface QueuedFollowUpRowProps {
  item: QueuedFollowUp;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  isDragTarget: boolean;
  onEdit?: (item: QueuedFollowUp) => void;
  onRemove?: (itemId: string) => void;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, itemId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, itemId: string) => void;
}

const QueuedFollowUpRow = (props: QueuedFollowUpRowProps) => {
  const {
    item,
    index,
    isFirst,
    isLast,
    isEditing,
    isDragTarget,
    onEdit,
    onRemove,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
  } = props;
  const canEdit = Boolean(onEdit);
  const canRemove = Boolean(onRemove);
  const canDrag = !isFirst || !isLast;
  const dragLabel = `Drag queued follow-up ${index + 1}`;

  return (
    <Box
      minWidth="0"
      borderTopWidth={isFirst ? "0" : "1px"}
      borderColor={isDragTarget ? "border.accent-light" : "border.subtle"}
      paddingTop={isFirst ? "0" : "2xs"}
      paddingBottom="2xs"
      bg={isEditing ? "bg.muted" : undefined}
      onDragOver={(event) => onDragOver(event, item.id)}
      onDrop={(event) => onDrop(event, item.id)}
      data-queued-follow-up-id={item.id}
    >
      <HStack gap="xs" alignItems="flex-start">
        <IconButton
          size="2xs"
          variant="ghost"
          draggable={canDrag}
          aria-label={dragLabel}
          title={dragLabel}
          color="fg.muted"
          cursor={canDrag ? "grab" : "default"}
          disabled={!canDrag}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", item.id);
            onDragStart(item.id);
          }}
          onDragEnd={onDragEnd}
        >
          <ChakraIcon as={GripVertical} boxSize="14px" />
        </IconButton>
        <Stack gap="2xs" flex="1" minWidth="0">
          <Text textStyle="label/S/regular" color="fg" lineClamp={2} minWidth="0">
            {item.prompt}
          </Text>
          {item.attachments?.length ? (
            <Badge width="fit-content" size="sm" variant="outline" colorPalette="gray">
              {item.attachments.length} attachments
            </Badge>
          ) : null}
        </Stack>
        <HStack gap="2xs" flexShrink={0}>
          {canEdit ? (
            <IconButton size="2xs" variant="ghost" aria-label="Edit queued follow-up" onClick={() => onEdit?.(item)}>
              <ChakraIcon as={Pencil} boxSize="14px" />
            </IconButton>
          ) : null}
          {canRemove ? (
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label="Remove queued follow-up"
              colorPalette="red"
              onClick={() => onRemove?.(item.id)}
            >
              <ChakraIcon as={Trash2} boxSize="14px" />
            </IconButton>
          ) : null}
        </HStack>
      </HStack>
    </Box>
  );
};

export const QueuedFollowUpList = (props: QueuedFollowUpListProps) => {
  const { items, editingItemId, onEdit, onRemove, onMove } = props;
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragTargetItemId, setDragTargetItemId] = useState<string | null>(null);
  if (items.length === 0) return null;

  const handleDragOver = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    if (!draggedItemId || draggedItemId === itemId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTargetItemId(itemId);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    event.preventDefault();
    const sourceItemId = draggedItemId ?? event.dataTransfer.getData("text/plain");
    setDraggedItemId(null);
    setDragTargetItemId(null);
    if (!sourceItemId || sourceItemId === itemId) return;

    const sourceIndex = items.findIndex((item) => item.id === sourceItemId);
    const targetIndex = items.findIndex((item) => item.id === itemId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const direction: QueuedFollowUpMoveDirection = targetIndex < sourceIndex ? "up" : "down";
    onMove?.(sourceItemId, direction, Math.abs(targetIndex - sourceIndex));
  };

  return (
    <Stack
      gap="2xs"
      paddingX="0"
      paddingY="xs"
      borderWidth="1px"
      borderBottomWidth="0"
      borderColor="border"
      borderTopRadius="xs"
      background="bg"
    >
      {items.map((item, index) => (
        <QueuedFollowUpRow
          key={item.id}
          item={item}
          index={index}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          isEditing={editingItemId === item.id}
          isDragTarget={dragTargetItemId === item.id}
          onEdit={onEdit}
          onRemove={onRemove}
          onDragStart={setDraggedItemId}
          onDragEnd={() => {
            setDraggedItemId(null);
            setDragTargetItemId(null);
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </Stack>
  );
};
