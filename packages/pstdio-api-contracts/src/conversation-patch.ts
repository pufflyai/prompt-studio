import type { JsonPatch } from "./conversation-events";
import type { SessionMessage } from "./session-messages";
import { normalizeMessageResults } from "./tool-result";

export const normalizeConversationPatch = (patch: JsonPatch) => {
  if (patch.op === "remove") return patch;
  if (patch.path === "/messages" && Array.isArray(patch.value))
    return { ...patch, value: (patch.value as SessionMessage[]).map(normalizeMessageResults) };
  if (/^\/messages\/\d+$/.test(patch.path))
    return { ...patch, value: normalizeMessageResults(patch.value as SessionMessage) };
  return patch;
};

/** Applies one conversation patch. The host and an extension worker's local snapshot both use it. */
export const applyConversationPatch = (messages: SessionMessage[], patch: JsonPatch) => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    if (!Array.isArray(patch.value)) throw new Error("Conversation replacement must be an array");
    return [...(patch.value as SessionMessage[])];
  }
  const match = /^\/messages\/(\d+)$/.exec(patch.path);
  if (!match) return messages;
  const index = Number(match[1]);
  const limit = patch.op === "add" ? messages.length : messages.length - 1;
  if (!Number.isSafeInteger(index) || index > limit) throw new Error("Invalid conversation patch position");
  if (patch.op === "add") messages.splice(index, 0, patch.value as SessionMessage);
  else if (patch.op === "replace") messages[index] = patch.value as SessionMessage;
  else messages.splice(index, 1);
  return messages;
};
