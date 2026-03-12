import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { SessionStatus } from "../types";

export interface JsonPatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

interface SessionCacheEntry {
  messages: SessionMessage[];
  status: SessionStatus | null;
}

const sessionStreamCache = new Map<string, SessionCacheEntry>();

export const getCachedSessionEntry = (sessionId: string) => {
  const entry = sessionStreamCache.get(sessionId);

  if (!entry) {
    return { messages: [] as SessionMessage[], status: null as SessionStatus | null };
  }

  return { messages: [...entry.messages], status: entry.status };
};

export const updateCachedSessionEntry = (sessionId: string, update: Partial<SessionCacheEntry>) => {
  const current = sessionStreamCache.get(sessionId) ?? { messages: [], status: null };
  sessionStreamCache.set(sessionId, {
    messages: update.messages ? [...update.messages] : current.messages,
    status: update.status ?? current.status,
  });
};

export const clearSessionStreamCache = () => {
  sessionStreamCache.clear();
};

export const applyMessagePatch = (messages: SessionMessage[], patch: JsonPatch): SessionMessage[] => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    return patch.value as SessionMessage[];
  }

  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) return messages;

  const index = Number(match[1]);
  const next = [...messages];

  if (patch.op === "add") {
    next.splice(index, 0, patch.value as SessionMessage);
  } else if (patch.op === "replace") {
    next[index] = patch.value as SessionMessage;
  } else if (patch.op === "remove") {
    next.splice(index, 1);
  }

  return next;
};
