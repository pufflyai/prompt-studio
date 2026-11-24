import type { SessionMessage } from "pstdio-api-contracts";
import type { PendingQueueEntry } from "./session-scheduler-internals";
import { submittedMessageSender } from "./submitted-message-identity";

type SenderEntry = Pick<
  PendingQueueEntry,
  "session_id" | "queue_position" | "prompt" | "sender_json" | "steering_delivery_json"
>;

// Text, clocks and turn positions cannot distinguish an unsent handoff from a later request.
// Steering supplies an exact provider delivery ID; other requests need their saved requestId.
const matchesRequest = (message: SessionMessage, entry: SenderEntry) =>
  entry.steering_delivery_json !== null && message.id === entry.steering_delivery_json.id;

export const recoverMessageSenders = (messages: SessionMessage[], entries: SenderEntry[]) => {
  const result = [...messages];
  for (const entry of entries) {
    if (!entry.sender_json) continue;
    const candidates = result.flatMap((message, index) => {
      if (message.role !== "user") return [];
      return !message.sender && matchesRequest(message, entry) ? [index] : [];
    });
    if (candidates.length !== 1) continue;
    const index = candidates[0];
    result[index] = {
      ...result[index],
      sender: submittedMessageSender({
        sessionId: entry.session_id,
        submittedQueuePosition: entry.queue_position,
        sender: entry.sender_json,
      }),
    };
  }
  return result;
};
