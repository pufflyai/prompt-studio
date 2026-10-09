import { Box, HStack, IconButton, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { DropIndicator } from "@/components/primitives/drop-indicator";
import { queuedFollowUpRecipe } from "@/theme/recipes/queued-follow-up";
import type { QueuedFollowUp } from "./message-types";
import { QueueDropZone } from "./queued-follow-up-drag";

interface QueuedFollowUpRowProps {
  item: QueuedFollowUp;
  index: number;
  editor?: ReactNode;
  source: boolean;
  destination?: string;
  unavailableReason?: string | null;
  editing: boolean;
  onEdit?: (item: QueuedFollowUp) => void;
  onRemove?: (id: string) => void;
}
export const QueuedFollowUpRow = (props: QueuedFollowUpRowProps) => {
  const { item, index, editor, source, destination, unavailableReason, editing, onEdit, onRemove } = props;
  const drag = useDraggable({ id: item.id, data: { item }, disabled: Boolean(item.steeringDelivery) });
  const styles = useSlotRecipe({ recipe: queuedFollowUpRecipe })();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const exit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const row = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => clearTimeout(exit.current), []);
  useEffect(() => {
    if (editing) row.current?.scrollIntoView({ block: "nearest" });
  }, [editing]);
  const reveal = () => {
    clearTimeout(exit.current);
    setHovered(true);
  };
  const compact = !editor;
  return (
    <Box
      className="group"
      ref={(node: HTMLDivElement | null) => {
        drag.setNodeRef(node);
        row.current = node;
      }}
      css={styles.row}
      data-drag-source={source}
      data-combine-target={destination === "combine" && !unavailableReason}
      data-queued-follow-up-id={item.id}
      onPointerEnter={reveal}
      onPointerLeave={() => {
        exit.current = setTimeout(() => setHovered(false), 150);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") reveal();
      }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onClick={(event) => {
        if (compact && !(event.target as Element).closest("button")) onEdit?.(item);
      }}
    >
      <IconButton
        ref={drag.setActivatorNodeRef}
        {...drag.listeners}
        {...drag.attributes}
        aria-label={`Drag queued follow-up ${index + 1}`}
        size="2xs"
        variant="ghost"
        css={styles.handle}
        disabled={Boolean(item.steeringDelivery)}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical size={14} />
      </IconButton>
      <Stack flex="1" minW="0" gap="2xs">
        {editor ?? (
          <Box asChild css={styles.content}>
            <button type="button" aria-label={`Edit queued message: ${item.prompt}`} onClick={() => onEdit?.(item)}>
              <Text lineClamp={2}>{item.prompt}</Text>
              <Text color="fg.muted" textStyle="label/XS" lineClamp={1}>
                {destination === "combine"
                  ? (unavailableReason ?? "Release to combine")
                  : [
                      item.model,
                      ...Object.values(item.params ?? {}).map(String),
                      ...(item.attachments?.map((attachment) => attachment.name) ?? []),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Saved request"}
              </Text>
            </button>
          </Box>
        )}
        {item.steeringDelivery ? (
          <Text css={styles.notice}>Delivery is unconfirmed. Saved input is kept and will not be replayed.</Text>
        ) : null}
      </Stack>
      {onRemove && !editor && !item.steeringDelivery ? (
        <HStack css={styles.actions} data-visible={hovered || focused || editing}>
          <IconButton
            aria-label="Remove queued follow-up"
            size="2xs"
            variant="destructive-ghost"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(item.id);
            }}
          >
            <Trash2 size={14} />
          </IconButton>
        </HStack>
      ) : null}
      <QueueDropZone item={item} index={index} kind="before" />
      <QueueDropZone item={item} index={index} kind="combine" />
      <QueueDropZone item={item} index={index} kind="after" />
      {destination === "before" ? <DropIndicator top="0" /> : null}
      {destination === "after" ? <DropIndicator bottom="0" /> : null}
    </Box>
  );
};
