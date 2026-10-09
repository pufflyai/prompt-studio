import type {
  CombineQueuedFollowUpsInput,
  QueuedFollowUpUpdateResponse,
  QueuedSteeringResult,
  SteerQueuedFollowUpInput,
  UpdateQueuedFollowUpInput,
} from "@pstdio/sdk/api";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

interface QueueTarget {
  sessionId: string;
  queuePosition: number;
}
const path = (input: QueueTarget) => `/v1/sessions/${input.sessionId}/queued-follow-ups/${input.queuePosition}`;
export const useUpdateQueuedFollowUp = () =>
  useMutation({
    mutationFn: (input: QueueTarget & UpdateQueuedFollowUpInput) => {
      const { sessionId, queuePosition, ...request } = input;
      return apiRequest<QueuedFollowUpUpdateResponse>(path({ sessionId, queuePosition }), {
        method: "PATCH",
        body: request,
      });
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
    ) =>
      apiRequest<{ ok: true }>(`${path(input)}?expectedRevision=${encodeURIComponent(input.expectedRevision ?? "")}`, {
        method: "DELETE",
      }),
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
      apiRequest<{ ok: true; queuePosition: number }>(`${path(input)}/move`, {
        method: "POST",
        body: {
          direction: input.direction,
          expectedRevision: input.expectedRevision,
          steps: input.steps,
          expectedOrder: input.expectedOrder,
        },
      }),
  });
export const useCombineQueuedFollowUps = () =>
  useMutation({
    mutationFn: (input: QueueTarget & CombineQueuedFollowUpsInput) =>
      apiRequest<QueuedFollowUpUpdateResponse>(`${path(input)}/combine`, {
        method: "POST",
        body: {
          sourcePosition: input.sourcePosition,
          sourceRevision: input.sourceRevision,
          targetRevision: input.targetRevision,
        },
      }),
  });
export const useSteerQueuedFollowUp = () =>
  useMutation({
    mutationFn: (input: QueueTarget & SteerQueuedFollowUpInput) =>
      apiRequest<QueuedSteeringResult>(`${path(input)}/steer`, {
        method: "POST",
        body: { expectedRevision: input.expectedRevision, expectedRunStartedAt: input.expectedRunStartedAt },
      }),
  });
