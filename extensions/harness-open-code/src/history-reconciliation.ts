import type { HarnessEventSink, HarnessRecoveryInput, SessionMessage } from "@pstdio/sdk/extensions";
import {
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

// Ids made from a message's position say nothing about which turn it is.
const synthetic = (message: SessionMessage) => /^(?:saved-)*opencode-msg-\d+$/.test(message.id);
const hasHostMetadata = (turn: SessionMessage[]) =>
  turn.some(isGenerated) || turn[0].parts.some((part) => part.type === "file");

const mergeTurn = (previous: SessionMessage[], turn: SessionMessage[]) => {
  const promptChanged = submittedPrompt(previous[0]) !== submittedPrompt(turn[0]);
  const oldMessages = new Map(previous.map((message) => [message.id, message]));
  const merged = turn.map((message, index) => {
    // OpenCode saves a message before its parts, so earlier text may be incomplete.
    if (index === 0 && promptChanged) return message;
    const old = index === 0 ? previous[0] : oldMessages.get(message.id);
    return old ? mergeHistoryMetadata(old, message) : message;
  });
  const ids = new Set(merged.map((message) => message.id));
  return [...merged, ...previous.filter((message) => isGenerated(message) && !ids.has(message.id))];
};

// Polls own provider turn membership. If identity is uncertain, keep the saved
// metadata on its original turn instead of guessing its owner or stopping the agent.
export const composeOpencodeSnapshot = (
  known: readonly SessionMessage[],
  native: readonly SessionMessage[],
  onHistoryRecovery?: () => void,
) => {
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
  const matches = newTurns.map((turn) => {
    const exact = synthetic(turn[0]) ? undefined : byId.get(turn[0].id);
    if (exact) return { previous: exact, uncertain: [] };
    const prompt = submittedPrompt(turn[0]);
    const candidates = (byPrompt.get(prompt) ?? []).filter(
      (candidate) => synthetic(candidate[0]) || synthetic(turn[0]),
    );
    if (candidates.length === 1 && newCounts.get(prompt) === 1) return { previous: candidates[0], uncertain: [] };
    return { previous: undefined, uncertain: candidates.filter(hasHostMetadata) };
  });
  const claimed = new Set(matches.map((match) => match.previous));
  const usedIds = new Set(native.map((message) => message.id));
  let recovered = false;
  const messages = newTurns.flatMap((turn, index) => {
    const { previous, uncertain } = matches[index];
    const retained = uncertain
      .filter((candidate) => !claimed.has(candidate))
      .flatMap((candidate) => {
        claimed.add(candidate);
        recovered = true;
        return candidate.map((message) => {
          let id = message.id;
          // A retained positional id may now name a different native message.
          while (usedIds.has(id)) id = `saved-${id}`;
          usedIds.add(id);
          return id === message.id ? message : { ...message, id };
        });
      });
    return [...retained, ...(previous ? mergeTurn(previous, turn) : turn)];
  });
  if (recovered) onHistoryRecovery?.();
  return messages;
};

export const composeOwnedOpencodeSnapshot = (
  events: HarnessEventSink,
  native: readonly SessionMessage[],
  onHistoryRecovery?: () => void,
) => composeOpencodeSnapshot(events.getMessages(), native, onHistoryRecovery);
