import type { HarnessRecoveryInput, SessionMessage } from "@pstdio/sdk/extensions";
import {
  HistoryConflict,
  mergeHistoryMetadata,
  reconcileMessageHistory,
  splitHistoryTurns,
  submittedPrompt,
} from "@pstdio/sdk/extensions";

const isGenerated = (message: SessionMessage) =>
  message.role === "system" &&
  /^opencode-error-.+-\d+$/.test(message.id) &&
  message.parts.length === 1 &&
  message.parts[0].type === "error";

export const recoverOpencodeMessages = (input: HarnessRecoveryInput) => reconcileMessageHistory(input, { isGenerated });

// Polls are authoritative about provider turn membership. Recovery is a separate
// operation: it can restore missing turns, whereas a poll must honor deletions.
export const composeOpencodeSnapshot = (known: readonly SessionMessage[], native: readonly SessionMessage[]) => {
  const oldTurns = splitHistoryTurns(known);
  const newTurns = splitHistoryTurns(native);
  const byId = new Map(oldTurns.map((turn) => [turn[0].id, turn]));
  const byPrompt = new Map<string, SessionMessage[][]>();
  for (const turn of oldTurns) {
    const prompt = submittedPrompt(turn[0]);
    byPrompt.set(prompt, [...(byPrompt.get(prompt) ?? []), turn]);
  }
  const newCounts = new Map<string, number>();
  for (const turn of newTurns) {
    const prompt = submittedPrompt(turn[0]);
    newCounts.set(prompt, (newCounts.get(prompt) ?? 0) + 1);
  }
  return newTurns.flatMap((turn) => {
    const prompt = submittedPrompt(turn[0]);
    let previous = byId.get(turn[0].id);
    if (previous && submittedPrompt(previous[0]) !== prompt) throw new HistoryConflict("conflicting_user_content");
    if (!previous) {
      const synthetic = (message: SessionMessage) => /^opencode-msg-\d+$/.test(message.id);
      const matches = (byPrompt.get(prompt) ?? []).filter((candidate) => synthetic(candidate[0]) || synthetic(turn[0]));
      if (matches.length === 1 && newCounts.get(prompt) === 1) previous = matches[0];
      else if (
        matches.some(
          (candidate) => candidate.some(isGenerated) || candidate[0].parts.some((part) => part.type === "file"),
        )
      ) {
        throw new HistoryConflict("ambiguous_metadata_owner");
      }
    }
    if (!previous) return turn;
    const oldMessages = new Map(previous.map((message) => [message.id, message]));
    const merged = turn.map((message, index) => {
      const old = index === 0 ? previous[0] : oldMessages.get(message.id);
      return old ? mergeHistoryMetadata(old, message) : message;
    });
    const ids = new Set(merged.map((message) => message.id));
    return [...merged, ...previous.filter((message) => isGenerated(message) && !ids.has(message.id))];
  });
};
