import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type QueuedFollowUpMoveDirection = "up" | "down";

interface QueuedFollowUpActionInput {
  sessionId: string;
  queuePosition: number;
}

interface UpdateQueuedFollowUpInput extends QueuedFollowUpActionInput {
  prompt: string;
}

interface MoveQueuedFollowUpInput extends QueuedFollowUpActionInput {
  direction: QueuedFollowUpMoveDirection;
}

export const useUpdateQueuedFollowUp = () =>
  useMutation({
    mutationFn: (input: UpdateQueuedFollowUpInput) =>
      apiRequest<{ ok: true }>(`/v1/sessions/${input.sessionId}/queued-follow-ups/${input.queuePosition}`, {
        method: "PATCH",
        body: { prompt: input.prompt },
      }),
  });

export const useRemoveQueuedFollowUp = () =>
  useMutation({
    mutationFn: (input: QueuedFollowUpActionInput) =>
      apiRequest<{ ok: true }>(`/v1/sessions/${input.sessionId}/queued-follow-ups/${input.queuePosition}`, {
        method: "DELETE",
      }),
  });

export const useMoveQueuedFollowUp = () =>
  useMutation({
    mutationFn: (input: MoveQueuedFollowUpInput) =>
      apiRequest<{ ok: true; queuePosition: number }>(
        `/v1/sessions/${input.sessionId}/queued-follow-ups/${input.queuePosition}/move`,
        {
          method: "POST",
          body: { direction: input.direction },
        },
      ),
  });
