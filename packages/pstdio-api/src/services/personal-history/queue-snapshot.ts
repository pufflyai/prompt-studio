import type { SessionMessage, SessionQueuedMessagesResponse } from "pstdio-api-contracts";
import { z } from "zod";

// The index is synced whole, so a session record carries a bounded copy of its queue.
export const maxSharedQueueRequests = 20;
export const maxSharedQueuePrompt = 4000;

export const sharedQueueSchema = z.array(
  z.object({
    queuePosition: z.number().int().positive(),
    revision: z.string(),
    prompt: z.string(),
    model: z.string().nullable(),
  }),
);
export type SharedQueue = z.infer<typeof sharedQueueSchema>;

interface QueueEntry {
  queue_position: number;
  revision: string;
  prompt: string;
  model: string | null;
  request_kind: string;
}

/** The queued messages other devices show for a session, in queue order. */
export const sharedQueue = (entries: QueueEntry[]): SharedQueue =>
  entries
    .filter((entry) => entry.request_kind === "start" || entry.request_kind === "follow_up")
    .slice(0, maxSharedQueueRequests)
    .map((entry) => ({
      queuePosition: entry.queue_position,
      revision: entry.revision,
      prompt:
        entry.prompt.length > maxSharedQueuePrompt ? `${entry.prompt.slice(0, maxSharedQueuePrompt)}…` : entry.prompt,
      model: entry.model,
    }));

export const otherDeviceQueueReason = "Continue this session on its device.";

/** Read-only queue response for a session that runs on another device. */
export const sharedQueueResponse = (sessionId: string, queue: SharedQueue): SessionQueuedMessagesResponse => ({
  messages: queue.map(
    (request): SessionMessage => ({
      id: `queued-prompt-${sessionId}-${request.queuePosition}`,
      role: "user",
      parts: [{ type: "text", text: request.prompt }],
    }),
  ),
  queue: {
    requests: queue.map((request) => ({
      ...request,
      steeringUnavailableReason: otherDeviceQueueReason,
      steeringDelivery: null,
      params: {},
      attachments: [],
    })),
    activeRunStartedAt: null,
    steeringAvailable: false,
    steeringUnavailableReason: otherDeviceQueueReason,
  },
});
