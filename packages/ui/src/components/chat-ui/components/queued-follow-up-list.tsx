import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { queuedFollowUpRecipe } from "@/theme/recipes/queued-follow-up";
import type { QueuedFollowUp } from "./message-types";
import { QueueSendNow, queueKeyboardCoordinates } from "./queued-follow-up-drag";
import type { QueuedFollowUpMoveDirection } from "./queued-follow-up-list-state";
import { QueuedFollowUpRow } from "./queued-follow-up-row";

interface QueuedFollowUpListProps {
  items: QueuedFollowUp[];
  editingItemId?: string | null;
  editor?: ReactNode;
  dirtyItemIds?: string[];
  steeringUnavailableReason?: string | null;
  onEdit?: (item: QueuedFollowUp) => void;
  onRemove?: (itemId: string) => void;
  onMove?: (
    itemId: string,
    direction: QueuedFollowUpMoveDirection,
    steps?: number,
    selection?: { source: QueuedFollowUp; items: QueuedFollowUp[] },
  ) => void | Promise<void>;
  onSteer?: (item: QueuedFollowUp) => void | Promise<void>;
  onCombine?: (source: QueuedFollowUp, target: QueuedFollowUp) => void | Promise<void>;
}
const settingsKey = (item: QueuedFollowUp) =>
  JSON.stringify([item.model, Object.entries(item.params ?? {}).sort(([a], [b]) => a.localeCompare(b))]);
export const QueuedFollowUpList = (props: QueuedFollowUpListProps) => {
  const {
    items,
    editingItemId,
    editor,
    dirtyItemIds = [],
    steeringUnavailableReason,
    onEdit,
    onRemove,
    onMove,
    onSteer,
    onCombine,
  } = props;
  const styles = useSlotRecipe({ recipe: queuedFollowUpRecipe })();
  const [keyboardTarget, setKeyboardTarget] = useState<string | number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, context) => queueKeyboardCoordinates(event, context, setKeyboardTarget),
    }),
  );
  const [source, setSource] = useState<QueuedFollowUp | null>(null);
  const [dragItems, setDragItems] = useState<QueuedFollowUp[]>([]);
  const [destination, setDestination] = useState<{ kind: string; item?: QueuedFollowUp } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!items.length) return null;
  const steerReason =
    source?.steeringUnavailableReason ??
    steeringUnavailableReason ??
    (source && dirtyItemIds.includes(source.id) ? "Update or Cancel this edit before sending." : null);
  const combineReason = (target: QueuedFollowUp) => {
    if (!source || source.id === target.id) return "Choose another request.";
    if (dirtyItemIds.includes(source.id) || dirtyItemIds.includes(target.id))
      return "Update or Cancel the edits first.";
    if (settingsKey(source) !== settingsKey(target)) return "Model and thinking settings must match.";
    if (target.steeringDelivery) return "Delivery is still being confirmed.";
    return null;
  };
  const reorder = (selected: QueuedFollowUp, target: QueuedFollowUp, kind: string) => {
    const eligible = dragItems.filter((item) => !item.steeringDelivery);
    const start = eligible.findIndex((item) => item.id === selected.id);
    const end = eligible.findIndex((item) => item.id === target.id);
    if (start < 0 || end < 0 || start === end) return;
    const insertion = end + (kind === "after" ? 1 : 0);
    const next = insertion - (start < insertion ? 1 : 0);
    if (next === start) return;
    return onMove?.(selected.id, next < start ? "up" : "down", Math.abs(next - start), {
      source: selected,
      items: dragItems,
    });
  };
  const performDrop = (selected: QueuedFollowUp, target: { kind: string; item?: QueuedFollowUp }) => {
    if (target.kind === "steer") {
      if (!steerReason) return onSteer?.(selected);
      return;
    }
    if (!target.item) return;
    if (target.kind === "combine") {
      if (!combineReason(target.item)) return onCombine?.(selected, target.item);
      return;
    }
    return reorder(selected, target.item, target.kind);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        if (!args.pointerCoordinates && keyboardTarget !== null) return [{ id: keyboardTarget }];
        const pointer = pointerWithin(args);
        return pointer.length ? pointer : rectIntersection(args);
      }}
      autoScroll
      onDragStart={(event) => {
        setKeyboardTarget(null);
        setSource(event.active.data.current?.item ?? null);
        setDragItems(items);
        setError(null);
      }}
      onDragOver={(event) =>
        setDestination((event.over?.data.current as { kind: string; item?: QueuedFollowUp }) ?? null)
      }
      onDragCancel={() => {
        setKeyboardTarget(null);
        setSource(null);
        setDestination(null);
      }}
      onDragEnd={(event) => {
        const selected = source;
        const target = event.over?.data.current;
        setSource(null);
        setDestination(null);
        if (!selected || !target || pending) return;
        setPending(true);
        void Promise.resolve()
          .then(() => performDrop(selected, target as { kind: string; item?: QueuedFollowUp }))
          .catch((failure) =>
            setError(failure instanceof Error ? failure.message : "Could not change the queue. Saved input is kept."),
          )
          .finally(() => setPending(false));
      }}
    >
      <Box css={styles.root} data-dragging={Boolean(source)} aria-busy={pending}>
        <QueueSendNow visible={Boolean(source)} targeted={destination?.kind === "steer"} reason={steerReason} />
        <ScrollArea maxH="queue-viewport" minH="0" viewportProps={{ maxH: "queue-viewport" }}>
          {items.map((item, index) => (
            <QueuedFollowUpRow
              key={item.id}
              item={item}
              index={index}
              source={source?.id === item.id}
              destination={destination?.item?.id === item.id ? destination.kind : undefined}
              unavailableReason={destination?.kind === "combine" ? combineReason(item) : null}
              editing={editingItemId === item.id}
              editor={editingItemId === item.id ? editor : undefined}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </ScrollArea>
        {error ? (
          <Text css={styles.notice} role="alert">
            {error}
          </Text>
        ) : null}
      </Box>
    </DndContext>
  );
};
