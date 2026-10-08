import type { HarnessEventSink, HarnessRecoveryInput, SessionMessage, ToolPart } from "@pstdio/sdk/extensions";
import { toThreadItem } from "./app-server-items";
import { errorMessage, itemToMessage } from "./items";
import { nativeHistoryAfterLegacyBoundary } from "./legacy-history";
import type { ThreadItem } from "./protocol/v2/ThreadItem";
import type { Turn } from "./protocol/v2/Turn";

export const nativeItemMessage = (item: ThreadItem, turnId: string) => {
  const id = `codex-${turnId}-${item.id}`;
  if (item.type === "contextCompaction")
    return {
      id: `codex-${turnId}-compaction`,
      role: "system" as const,
      parts: [{ type: "text" as const, text: "Native context compaction completed." }],
    };
  if (item.type === "userMessage")
    return {
      id,
      role: "user" as const,
      parts: item.content.flatMap((content) =>
        content.type === "text"
          ? [{ type: "text" as const, text: content.text.split("\n\n<session-attachments>")[0] }]
          : [],
      ),
    };
  if (item.type === "plan")
    return { id, role: "assistant" as const, parts: [{ type: "text" as const, text: item.text }] };
  const adapted = toThreadItem(item);
  if (!adapted) return null;
  if (item.type === "imageView") adapted.status = "completed";
  return itemToMessage(adapted, `codex-${turnId}`);
};

export const nativeThreadMessages = (turns: Turn[]) =>
  turns.flatMap((turn) => {
    const createdAt = turn.startedAt ? turn.startedAt * 1000 : undefined;
    const items = turn.items.flatMap((item) => {
      const message = nativeItemMessage(item, turn.id);
      return message ? [{ ...message, createdAt }] : [];
    });
    if (turn.status === "failed")
      items.push({
        ...errorMessage(turn.error?.message, `codex-${turn.id}-error`, createdAt ?? Date.now()),
        createdAt,
      });
    return items;
  });

export const recoverNativeHistory = (input: Pick<HarnessRecoveryInput, "knownMessages" | "nativeMessages">) => {
  const messages = [...input.knownMessages];
  const native = nativeHistoryAfterLegacyBoundary(input.knownMessages, input.nativeMessages);
  for (const [index, message] of native.entries()) {
    const position = messages.findIndex((known) => known.id === message.id);
    if (position < 0) {
      const following = new Set(native.slice(index + 1).map((next) => next.id));
      const successor = messages.findIndex((known) => following.has(known.id));
      messages.splice(successor < 0 ? messages.length : successor, 0, message);
      continue;
    }
    const known = messages[position];
    // Host metadata and visible messages survive provider compaction.
    const files = known.parts.filter((part) => part.type === "file");
    const parts = message.parts.map((part) => {
      if (part.type !== "tool") return part;
      const saved = known.parts.find(
        (candidate): candidate is ToolPart => candidate.type === "tool" && candidate.callId === part.callId,
      );
      if (saved?.state?.output !== undefined) return saved;
      return part;
    });
    messages[position] = { ...message, ...known, parts: [...parts, ...files] };
  }
  return { kind: "recovered" as const, messages };
};

export const createNativeProjection = (events: HarnessEventSink, prompt?: SessionMessage, offset?: number) => {
  const messages = [...events.getMessages()];
  if (offset && offset > messages.length) messages.length = offset;
  let pendingUserIndex: number | undefined;
  const publish = (message: SessionMessage, nativeUser = false) => {
    let index = messages.findIndex((known) => known?.id === message.id);
    if (nativeUser && pendingUserIndex !== undefined) {
      index = pendingUserIndex;
      pendingUserIndex = undefined;
    }
    const known = index >= 0 ? messages[index] : undefined;
    const value = {
      ...message,
      createdAt: known?.createdAt ?? message.createdAt ?? Date.now(),
      parts: [...message.parts, ...(known?.parts.filter((part) => part.type === "file") ?? [])],
    };
    if (index < 0) index = messages.length;
    const op = index < messages.length ? "replace" : "add";
    messages[index] = value;
    events.push({ op, path: `/messages/${index}`, value });
  };
  if (prompt) {
    pendingUserIndex = messages.length;
    const index = pendingUserIndex;
    messages.push(prompt);
    events.push({ op: "add", path: `/messages/${index}`, value: prompt });
  }
  return {
    publish,
    receive: (item: ThreadItem, turnId: string) => {
      const message = nativeItemMessage(item, turnId);
      if (message) publish(message, item.type === "userMessage");
    },
  };
};
