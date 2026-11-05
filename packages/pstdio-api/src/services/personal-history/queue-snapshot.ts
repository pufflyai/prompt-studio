import type { SessionMessage, SessionQueuedMessagesResponse } from "pstdio-api-contracts";
import { z } from "zod";

// Each session's queue is its own index record, so saving messages never re-sends it. The index is
// synced whole: other devices get a preview of each queued message, enough for its two-line row.
export const maxSharedQueueRequests = 50;
export const maxSharedQueuePrompt = 500;

const sharedRequestSchema = z.object({
  queuePosition: z.number().int().positive(),
  revision: z.string(),
  prompt: z.string(),
  model: z.string().nullable().catch(null),
});
export type SharedQueue = z.infer<typeof sharedRequestSchema>[];

/** A record another device wrote. A shape this version cannot read shows an empty queue. */
export const sharedQueueRecordSchema = z.object({
  id: z.string(),
  requests: z.array(sharedRequestSchema).catch([]),
});

interface QueueEntry {
  queue_position: number;
  revision: string;
  prompt: string;
  model: string | null;
  request_kind: string;
  steering_delivery_json: unknown;
}

const preview = (prompt: string) => {
  const characters = [...prompt];
  return characters.length > maxSharedQueuePrompt ? `${characters.slice(0, maxSharedQueuePrompt).join("")}…` : prompt;
};

/** The queued messages other devices show for a session, in queue order. */
export const sharedQueue = (entries: QueueEntry[]): SharedQueue =>
  entries
    // A request being steered into the running turn already belongs to the conversation.
    .filter(
      (entry) =>
        (entry.request_kind === "start" || entry.request_kind === "follow_up") && !entry.steering_delivery_json,
    )
    .slice(0, maxSharedQueueRequests)
    .map((entry) => ({
      queuePosition: entry.queue_position,
      revision: entry.revision,
      prompt: preview(entry.prompt),
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
    readOnly: true,
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
