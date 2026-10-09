import type { UpdateQueuedFollowUpInput } from "@pstdio/sdk/api";
import type { QueuedFollowUp } from "@pstdio/ui/chat-ui";
import { useState } from "react";
import {
  useCombineQueuedFollowUps,
  useMoveQueuedFollowUp,
  useRemoveQueuedFollowUp,
  useSteerQueuedFollowUp,
  useUpdateQueuedFollowUp,
} from "./use-queued-follow-up-actions";

interface QueuedSessionInput {
  sessionId: string | null;
  queuedFollowUps: QueuedFollowUp[];
  activeRunStartedAt?: string | null;
  editRequest(itemId: string, prompt: string): UpdateQueuedFollowUpInput;
  afterUpdate(itemId: string): void;
  refreshQueue(): void;
}
export const useQueuedSessionMessages = (input: QueuedSessionInput) => {
  const { sessionId, queuedFollowUps, activeRunStartedAt, editRequest, afterUpdate, refreshQueue } = input;
  const [actionError, setActionError] = useState<string | null>(null);
  const update = useUpdateQueuedFollowUp();
  const remove = useRemoveQueuedFollowUp();
  const move = useMoveQueuedFollowUp();
  const combine = useCombineQueuedFollowUps();
  const steer = useSteerQueuedFollowUp();
  const requireTarget = (item: QueuedFollowUp) => {
    if (!sessionId || item.position === undefined) throw new Error("The queued request is no longer available.");
    return { sessionId, queuePosition: item.position };
  };
  const handleQueuedFollowUpUpdate = async (itemId: string, prompt: string) => {
    const item = queuedFollowUps.find((item) => item.id === itemId);
    if (!item) throw new Error("The queued request changed. Your edit is kept.");
    await update.mutateAsync({ ...requireTarget(item), ...editRequest(itemId, prompt) });
    afterUpdate(itemId);
    refreshQueue();
  };
  const handleQueuedFollowUpRemove = (itemId: string) => {
    const item = queuedFollowUps.find((item) => item.id === itemId);
    if (!item) return;
    void remove
      .mutateAsync({ ...requireTarget(item), expectedRevision: item.revision })
      .then(refreshQueue)
      .catch((failure) =>
        setActionError(failure instanceof Error ? failure.message : "Could not remove the queued request."),
      );
  };
  const handleQueuedFollowUpMove = async (
    itemId: string,
    direction: "up" | "down",
    steps = 1,
    selection?: { source: QueuedFollowUp; items: QueuedFollowUp[] },
  ) => {
    const item = selection?.source ?? queuedFollowUps.find((item) => item.id === itemId);
    if (!item) return;
    await move.mutateAsync({
      ...requireTarget(item),
      direction,
      steps,
      expectedRevision: item.revision,
      expectedOrder: (selection?.items ?? queuedFollowUps)
        .filter((item) => !item.steeringDelivery)
        .map((request) => ({
          queuePosition: request.position!,
          revision: request.revision!,
        })),
    });
    refreshQueue();
  };
  const handleQueuedFollowUpCombine = async (source: QueuedFollowUp, target: QueuedFollowUp) => {
    if (!source.revision || !target.revision || source.position === undefined)
      throw new Error("Refresh the queue before combining.");
    await combine.mutateAsync({
      ...requireTarget(target),
      sourcePosition: source.position,
      sourceRevision: source.revision,
      targetRevision: target.revision,
    });
    refreshQueue();
  };
  const handleQueuedFollowUpSteer = async (item: QueuedFollowUp) => {
    if (!item.revision || !activeRunStartedAt) throw new Error("Refresh the queue before sending to the active work.");
    const result = await steer.mutateAsync({
      ...requireTarget(item),
      expectedRevision: item.revision,
      expectedRunStartedAt: activeRunStartedAt,
    });
    refreshQueue();
    if (result.status !== "accepted") throw new Error(result.message);
  };
  return {
    handleQueuedFollowUpUpdate,
    handleQueuedFollowUpRemove,
    handleQueuedFollowUpMove,
    handleQueuedFollowUpCombine,
    handleQueuedFollowUpSteer,
    actionError,
    clearActionError: () => setActionError(null),
  };
};
