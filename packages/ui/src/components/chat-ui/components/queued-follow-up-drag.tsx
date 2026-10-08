import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import { type KeyboardCoordinateGetter, useDroppable } from "@dnd-kit/core";
import { ArrowUp } from "lucide-react";
import { queuedFollowUpRecipe } from "@/theme/recipes/queued-follow-up";
import type { QueuedFollowUp } from "./message-types";

export const queueKeyboardCoordinates = (
  event: KeyboardEvent,
  { context }: Parameters<KeyboardCoordinateGetter>[1],
  onTarget?: (id: string | number) => void,
) => {
  const keys = ["ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(event.code)) return undefined;
  event.preventDefault();
  const targets = context.droppableContainers
    .getEnabled()
    .sort((a, b) => Number(a.data.current?.order) - Number(b.data.current?.order));
  const index = targets.findIndex((target) => target.id === context.over?.id);
  let next = index + (event.code === "ArrowUp" ? -1 : 1);
  if (event.code === "Home") next = 0;
  if (event.code === "End") next = targets.length - 1;
  const target = targets[Math.max(0, Math.min(targets.length - 1, next))];
  const rect = target && context.droppableRects.get(target.id);
  if (!rect) return undefined;
  onTarget?.(target.id);
  return {
    x: rect.left + (rect.width - (context.collisionRect?.width ?? 0)) / 2,
    y: rect.top + (rect.height - (context.collisionRect?.height ?? 0)) / 2,
  };
};

export const QueueDropZone = (props: { item: QueuedFollowUp; index: number; kind: "before" | "combine" | "after" }) => {
  const { item, index, kind } = props;
  const drop = useDroppable({
    id: `${item.id}:${kind}`,
    disabled: Boolean(item.steeringDelivery),
    data: { item, kind, order: index * 3 + ["before", "combine", "after"].indexOf(kind) },
  });
  const position = {
    before: { top: "0", height: "25%" },
    combine: { top: "25%", height: "50%" },
    after: { bottom: "0", height: "25%" },
  }[kind];
  return <Box ref={drop.setNodeRef} position="absolute" insetX="0" pointerEvents="none" {...position} />;
};

export const QueueSendNow = (props: { visible: boolean; targeted: boolean; reason?: string | null }) => {
  const { visible, targeted, reason } = props;
  const drop = useDroppable({ id: "queue-send-now", disabled: !visible, data: { kind: "steer", order: -1 } });
  const styles = useSlotRecipe({ recipe: queuedFollowUpRecipe })();
  if (!visible) return null;
  return (
    <Box ref={drop.setNodeRef} css={styles.sendNowHit}>
      <Box
        css={styles.sendNow}
        bottom="0"
        title={reason ?? undefined}
        aria-disabled={Boolean(reason)}
        data-targeted={targeted && !reason}
        data-queue-send-now
      >
        <ArrowUp size={14} />
        <Text>{"drop here to send now"}</Text>
      </Box>
    </Box>
  );
};
