import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { SyncedRow } from "@/lib/sync/collections";

interface CachedHistory {
  version: string;
  messages: SessionMessage[];
}

export const isSessionLive = (session: SyncedRow | undefined) =>
  session?.status === "in_progress" || session?.status === "awaiting_input";

export const sessionHistoryVersion = (session: SyncedRow | undefined) =>
  session &&
  JSON.stringify([session.updated_at, session.status, session.last_request_started, session.last_request_ended]);

const createSessionHistoryCache = () => {
  const queries = new QueryClient();
  const key = (id: string) => ["session-history", id];
  return {
    get(id: string, session: SyncedRow | undefined) {
      if (!session || isSessionLive(session) || queries.getQueryState(key(id))?.isInvalidated) return undefined;
      const cached = queries.getQueryData<CachedHistory>(key(id));
      return cached && cached.version === sessionHistoryVersion(session) ? cached.messages : undefined;
    },
    set(id: string, session: SyncedRow | undefined, messages: SessionMessage[]) {
      const version = sessionHistoryVersion(session);
      if (!version || isSessionLive(session)) return;
      queries.setQueryData<CachedHistory>(key(id), { version, messages });
    },
    invalidate(id: string) {
      void queries.invalidateQueries({ queryKey: key(id), exact: true });
    },
    retain(id: string) {
      // The existing query lifecycle removes history five minutes after its last view closes.
      const observer = new QueryObserver(queries, { queryKey: key(id), enabled: false });
      return observer.subscribe(() => {});
    },
  };
};

const caches = new WeakMap<object, ReturnType<typeof createSessionHistoryCache>>();

export const getSessionHistoryCache = (transport: object) => {
  let cache = caches.get(transport);
  if (!cache) {
    cache = createSessionHistoryCache();
    caches.set(transport, cache);
  }
  return cache;
};
