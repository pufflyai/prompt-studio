import type { splitQueuedFollowUps } from "../chat/queued-follow-ups";
import { moveQueuedFollowUpBySteps } from "../chat/session-chat-actions";
import {
  useMoveQueuedFollowUp,
  useRemoveQueuedFollowUp,
  useUpdateQueuedFollowUp,
} from "./use-queued-follow-up-actions";

interface QueuedSessionInput {
  sessionId: string | null;
  queuedFollowUps: ReturnType<typeof splitQueuedFollowUps>["queuedFollowUps"];
  refreshQueue(): void;
}
type QueuedFollowUpMoveDirection = "up" | "down";
export const useQueuedSessionMessages = (input: QueuedSessionInput) => {
  const { sessionId, queuedFollowUps, refreshQueue } = input;
  const queuedFollowUpPositions = new Map(queuedFollowUps.map((item) => [item.id, item.position]));
  const updateQueuedFollowUp = useUpdateQueuedFollowUp();
  const removeQueuedFollowUp = useRemoveQueuedFollowUp();
  const moveQueuedFollowUp = useMoveQueuedFollowUp();
  const mutateQueuedFollowUp = (
    itemId: string,
    mutate: (input: { sessionId: string; queuePosition: number }) => void,
  ) => {
    const queuePosition = queuedFollowUpPositions.get(itemId);
    if (!sessionId || queuePosition === undefined) return;

    mutate({ sessionId, queuePosition });
  };

  const handleQueuedFollowUpUpdate = (itemId: string, prompt: string) => {
    const queuePosition = queuedFollowUpPositions.get(itemId);
    if (!sessionId || queuePosition === undefined) return;

    updateQueuedFollowUp.mutate({ sessionId, queuePosition, prompt }, { onSuccess: refreshQueue });
  };

  const handleQueuedFollowUpRemove = (itemId: string) => {
    mutateQueuedFollowUp(itemId, (input) => removeQueuedFollowUp.mutate(input, { onSuccess: refreshQueue }));
  };

  const handleQueuedFollowUpMove = (itemId: string, direction: QueuedFollowUpMoveDirection, steps = 1) => {
    const queuePosition = queuedFollowUpPositions.get(itemId);
    if (!sessionId || queuePosition === undefined) return;

    void moveQueuedFollowUpBySteps({
      sessionId,
      queuePosition,
      direction,
      steps,
      mutation: moveQueuedFollowUp,
      reconnect: refreshQueue,
    });
  };

  return { handleQueuedFollowUpUpdate, handleQueuedFollowUpRemove, handleQueuedFollowUpMove };
};
