import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { ChatSession } from "./chat-session";

/** One bound across projects and renderers; pending domain work pins its common query owner. */
export const createChatOwnerRetention = () => {
  const sessions = new Map<ChatSession, { queries: ScopedQueryClient; retire(): void }>();
  const roots = new Map<ScopedQueryClient, { members: Set<ChatSession>; stop(): void }>();
  const untrack = (session: ChatSession) => {
    const entry = sessions.get(session);
    sessions.delete(session);
    if (!entry) return;
    const root = roots.get(entry.queries);
    root?.members.delete(session);
    if (root && !root.members.size) {
      roots.delete(entry.queries);
      root.stop();
    }
    return entry;
  };
  const remove = (session: ChatSession) => {
    untrack(session)?.retire();
  };
  const trim = () => {
    const inactive = [...sessions.keys()].filter((session) => !session.active());
    for (const session of inactive.slice(0, Math.max(0, inactive.length - 128))) remove(session);
  };
  return {
    trim,
    add(queries: ScopedQueryClient, session: ChatSession, retire: () => void) {
      let root = roots.get(queries);
      if (!root) {
        root = {
          members: new Set(),
          stop: queries.subscribeRetirement(() => {
            for (const candidate of [...sessions.keys()]) if (candidate.query.isDisposed()) remove(candidate);
          }),
        };
        roots.set(queries, root);
      }
      root.members.add(session);
      sessions.set(session, { queries, retire });
      trim();
      return () => {
        untrack(session);
      };
    },
    touch(session: ChatSession) {
      const retire = sessions.get(session);
      if (!retire) return;
      sessions.delete(session);
      sessions.set(session, retire);
    },
    dispose() {
      for (const session of [...sessions.keys()]) remove(session);
      for (const root of roots.values()) root.stop();
      roots.clear();
    },
  };
};
