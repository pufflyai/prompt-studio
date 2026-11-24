import { type SessionMessage, submittedPrompt } from "pstdio-api-contracts";
import type { PendingQueueEntry } from "./session-scheduler-internals";
import { submittedMessageSender } from "./submitted-message-sender";

type SenderEntry = Pick<
  PendingQueueEntry,
  "session_id" | "queue_position" | "prompt" | "sender_json" | "steering_delivery_json"
>;

const matchesRequest = (message: SessionMessage, turn: number, entry: SenderEntry) => {
  if (entry.steering_delivery_json) return message.id === entry.steering_delivery_json.id;
  if (submittedPrompt(message) !== entry.prompt.trim()) return false;
  // The host saves this exact turn boundary before invoking the provider. Native clocks are not delivery proof.
  return entry.sender_json?.afterTurn !== undefined && turn === entry.sender_json.afterTurn;
};

export const recoverMessageSenders = (messages: SessionMessage[], entries: SenderEntry[]) => {
  const result = [...messages];
  for (const entry of entries) {
    if (!entry.sender_json) continue;
    let turn = 0;
    const candidates = result.flatMap((message, index) => {
      if (message.role !== "user") return [];
      const position = turn++;
      return !message.sender && matchesRequest(message, position, entry) ? [index] : [];
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
