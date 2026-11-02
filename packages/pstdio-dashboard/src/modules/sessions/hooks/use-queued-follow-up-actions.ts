import type { CombineQueuedFollowUpsInput, SteerQueuedFollowUpInput, UpdateQueuedFollowUpInput } from "@pstdio/sdk/api";
import type { QueuedFollowUp } from "@pstdio/ui/chat-ui";
import { useMutation } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

interface QueueTarget {
  sessionId: string;
  queuePosition: number;
}
export const useUpdateQueuedFollowUp = () =>
  useMutation({
    mutationFn: (input: QueueTarget & UpdateQueuedFollowUpInput) => {
      const { sessionId, queuePosition, ...request } = input;
      return getApiClient().sessions.updateQueuedFollowUp(sessionId, queuePosition, request);
    },
  });
export const useRemoveQueuedFollowUp = () =>
  useMutation({
    mutationFn: (
      input: QueueTarget & {
        expectedRevision?: string;
        steps?: number;
        expectedOrder?: { queuePosition: number; revision: string }[];
      },
    ) => getApiClient().sessions.removeQueuedFollowUp(input.sessionId, input.queuePosition, input.expectedRevision),
  });
export const useMoveQueuedFollowUp = () =>
  useMutation({
    mutationFn: (
      input: QueueTarget & {
        direction: "up" | "down";
        expectedRevision?: string;
        steps?: number;
        expectedOrder?: { queuePosition: number; revision: string }[];
      },
    ) =>
      getApiClient().sessions.moveQueuedFollowUp(input.sessionId, input.queuePosition, {
        direction: input.direction,
        expectedRevision: input.expectedRevision,
        steps: input.steps,
        expectedOrder: input.expectedOrder,
      }),
  });
export const useCombineQueuedFollowUps = () =>
  useMutation({
    mutationFn: (input: QueueTarget & CombineQueuedFollowUpsInput) =>
      getApiClient().sessions.combineQueuedFollowUps(input.sessionId, input.queuePosition, {
        sourcePosition: input.sourcePosition,
        sourceRevision: input.sourceRevision,
        targetRevision: input.targetRevision,
      }),
  });
export const useSteerQueuedFollowUp = (refreshQueue: () => unknown) =>
  useMutation({
    mutationFn: (
      input: QueueTarget & SteerQueuedFollowUpInput & { item: QueuedFollowUp; previousUserMessageIds: string[] },
    ) =>
      getApiClient().sessions.steerQueuedFollowUp(input.sessionId, input.queuePosition, {
        expectedRevision: input.expectedRevision,
        expectedRunStartedAt: input.expectedRunStartedAt,
      }),
    onSettled: async () => {
      await refreshQueue();
    },
  });
