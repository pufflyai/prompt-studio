import type { SyncSpace } from "pstdio-sync/encryption";
import type { LiveConnection } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import { personalLiveTopic } from "../personal-history/live-messages";
import { sessionLogName } from "../personal-history/log-publisher";
import { genericSessionLogName } from "../personal-history/log-stream";

/** The relay reports readers immediately; unread sessions never build or encrypt previews. */
export const createPersonalLive = (input: {
  live: LiveConnection;
  history: { readingSessions: () => string[]; watchReaders: (listener: () => void) => () => void };
  owns: (documentId: string) => boolean;
  received: (message: Extract<LiveServerMessage, { type: "event" }>) => Promise<void>;
  changed: (id: string) => void;
  ready?: () => void;
  logChanged?: (id: string, format?: "append-log-v1") => void;
  logSource?: (id: string) => Promise<{ writerId?: string }>;
  watchingChanged?: (sessionId: string, active: boolean) => void;
}) => {
  let closed = false;
  let space: SyncSpace | undefined;
  let revision = 0;
  let own = new Set<string>();
  const stale = (version: number) => closed || revision !== version;
  const readers = new Map<string, { key: string; release: () => void }>();
  const following = new Map<string, () => void>();
  const active = new Set<string>();
  const logTopics = new Map<string, { id: string; format?: "append-log-v1" }>();
  const retire = (reading: Set<string>) => {
    for (const [id, reader] of readers)
      if (!reading.has(id)) {
        reader.release();
        readers.delete(id);
      }
    for (const [id, release] of following)
      if (!own.has(id)) {
        release();
        following.delete(id);
        active.delete(id);
      }
  };
  const subscribeReader = async (id: string, current: SyncSpace, topic: string, version: number, writerId?: string) => {
    const log = await current.documentId(writerId ? genericSessionLogName(id, writerId) : sessionLogName(id));
    if (stale(version)) return;
    logTopics.set(log, { id, ...(writerId ? { format: "append-log-v1" as const } : {}) });
    const preview = input.live.subscribe({ spaceOwner: current.spaceOwner, topic });
    const messages = input.live.subscribe({ spaceOwner: current.spaceOwner, topic: log });
    readers.set(id, {
      key: writerId ?? "legacy",
      release: () => {
        preview();
        messages();
        logTopics.delete(log);
      },
    });
  };
  const followSession = (id: string, current: SyncSpace, topic: string) => {
    following.set(
      id,
      input.live.follow({ spaceOwner: current.spaceOwner, topic }, (watching) => {
        if (watching) active.add(id);
        else active.delete(id);
        input.watchingChanged?.(id, watching);
      }),
    );
  };
  const reconcileReader = async (id: string, current: SyncSpace, topic: string, version: number) => {
    const source = await input.logSource?.(id);
    if (stale(version) || readers.get(id)?.key === (source?.writerId ?? "legacy")) return;
    readers.get(id)?.release();
    await subscribeReader(id, current, topic, version, source?.writerId);
  };
  const reconcile = async () => {
    const current = space;
    const version = ++revision;
    if (!current || closed) return;
    const reading = new Set(input.history.readingSessions());
    retire(reading);
    for (const id of new Set([...reading, ...own])) {
      const topic = await personalLiveTopic(current, id);
      if (stale(version)) return;
      if (reading.has(id)) await reconcileReader(id, current, topic, version);
      if (stale(version)) return;
      if (own.has(id) && !following.has(id)) followSession(id, current, topic);
    }
  };
  const stopReaders = input.history.watchReaders(() => void reconcile().catch(() => {}));
  const stop = input.live.listen((event) => {
    if (event.type === "ready") input.ready?.();
    if (event.type === "event") void input.received(event).catch(() => {});
    let documentId: string | undefined;
    if (event.type === "changed" || event.type === "discovered") documentId = event.documentId;
    if (event.type === "subscribed") documentId = event.topic;
    if (documentId && input.owns(documentId)) input.changed(documentId);
    const session = documentId && logTopics.get(documentId);
    if (session) input.logChanged?.(session.id, session.format);
  });
  const releaseAll = () => {
    for (const reader of readers.values()) reader.release();
    for (const release of following.values()) release();
    readers.clear();
    following.clear();
    active.clear();
  };
  return {
    async prepare(next: SyncSpace, sessions: Iterable<string> = []) {
      if (closed) return;
      if (space && (space.spaceOwner !== next.spaceOwner || space.generation !== next.generation)) releaseAll();
      space = next;
      own = new Set(sessions);
      await reconcile();
    },
    watching: (id: string) => active.has(id),
    send: (message: { spaceOwner: string | null; topic: string; payload: string }) => {
      if (!closed) input.live.publish(message, message.payload);
    },
    close() {
      if (closed) return;
      closed = true;
      revision++;
      stop();
      stopReaders();
      releaseAll();
    },
  };
};
