import type { NativeDocumentJoined, NativeDocumentSnapshot, NativeDocumentsClient } from "@pstdio/sdk/client";
import type { NativeParticipant } from "pstdio-api-contracts";
import { createTextReplica } from "pstdio-sync/text";
import type * as Y from "yjs";
import { registerNativeDocumentCloseGuard } from "./native-document-close-guard";
import { createNativeDocumentPresence } from "./native-document-presence";

export interface NativeDocumentSessionSnapshot {
  document: Y.Doc | null;
  pending: boolean;
  connected: boolean;
  participants: NativeParticipant[];
  error?: string;
}
export interface NativeDocumentSessionInput {
  projectId: string;
  target: Parameters<NativeDocumentsClient["open"]>[0]["target"];
  client: NativeDocumentsClient;
}
type Room = Pick<NativeDocumentJoined, "roomId" | "documentKey" | "seedId" | "sourceSeedId">;
const roomAddress = (projectId: string, room: Room) => ({
  projectId,
  documentKey: room.documentKey,
  roomId: room.roomId,
});

export const createNativeDocumentSession = (input: NativeDocumentSessionInput) => {
  let replica: ReturnType<typeof createTextReplica> | undefined;
  let stopLocal: (() => void) | undefined;
  let stopCloseGuard: (() => void) | undefined;
  let room: Room | undefined;
  let watch: AbortController | undefined;
  let operation: Promise<void> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closing = false;
  let open = true;
  let disposed = false;
  let requested = false;
  let state: NativeDocumentSessionSnapshot = { document: null, pending: false, connected: false, participants: [] };
  const listeners = new Set<() => void>();
  const streams = new Set<Promise<void>>();
  const publish = (patch: Partial<NativeDocumentSessionSnapshot> = {}) => {
    state = { ...state, ...patch, document: replica?.document ?? null, pending: replica?.pending() ?? false };
    for (const listener of listeners) listener();
  };
  const presence = createNativeDocumentPresence({ ...input, changed: (participants) => publish({ participants }) });
  const address = (value: Room) => roomAddress(input.projectId, value);
  const retire = async (value: Room | undefined) => {
    if (value) await input.client.close(address(value)).catch(() => {});
  };
  const background = () => {
    void drive().catch(() => {});
  };
  const schedule = () => {
    if (disposed || retryTimer || (!open && !replica?.pending())) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      background();
    }, 1_000);
  };
  const fail = (error: unknown) => {
    presence.disconnect();
    watch?.abort();
    void retire(room);
    room = undefined;
    publish({ connected: false, error: error instanceof Error ? error.message : String(error) });
    schedule();
  };
  const receive = (active: Room, snapshot: NativeDocumentSnapshot) => {
    active.seedId = snapshot.seedId;
    active.sourceSeedId = snapshot.sourceSeedId;
    const sameHistory = replica!.receive(snapshot);
    publish({ connected: true, error: undefined });
    if (!sameHistory) background();
  };
  const startWatch = (active: Room) => {
    watch?.abort();
    if (!open) return;
    const connection = new AbortController();
    watch = connection;
    presence.start(active, connection.signal);
    const reading = input.client
      .watch({
        ...address(active),
        signal: connection.signal,
        onSnapshot: (snapshot) => {
          if (room === active && !disposed && open && !connection.signal.aborted) receive(active, snapshot);
        },
        onPresence: (snapshot) => {
          if (room === active && !disposed && open && !connection.signal.aborted) presence.receive(active, snapshot);
        },
      })
      .then(() => {
        if (!connection.signal.aborted && room === active && !closing && !disposed)
          fail(new Error("The native document connection closed"));
      })
      .catch((error) => {
        if (!connection.signal.aborted && room === active && !closing && !disposed) fail(error);
      })
      .finally(() => streams.delete(reading));
    streams.add(reading);
  };
  const install = (joined: NativeDocumentJoined) => {
    const previous = replica;
    stopLocal?.();
    replica = createTextReplica(joined);
    stopCloseGuard ??= registerNativeDocumentCloseGuard(() => replica?.pending() ?? false, drive);
    stopLocal = replica.subscribe(() => {
      publish();
      background();
    });
    room = joined;
    publish({ error: undefined, connected: false });
    startWatch(room);
    previous?.dispose();
  };
  const join = async () => {
    const batch = replica?.capture();
    const joined = await input.client.open({
      projectId: input.projectId,
      target: input.target,
      sourceState: replica?.receivedState(),
      pendingUpdate: batch?.update,
    });
    if (!replica) {
      if (joined.sourceSeedId !== joined.seedId) {
        void retire(joined);
        return;
      }
      install(joined);
      return;
    }
    replica.acknowledge(batch!.count, joined);
    room = joined;
    publish({ error: undefined });
    startWatch(room);
  };
  const rebase = async (active: Room) => {
    const joined = await input.client.open({ projectId: input.projectId, target: input.target });
    if (replica!.pending() || joined.sourceSeedId !== joined.seedId) {
      void retire(joined);
      return;
    }
    void retire(active);
    install(joined);
  };
  const completeClose = async () => {
    if (disposed) return;
    disposed = true;
    presence.close();
    clearTimeout(retryTimer);
    watch?.abort();
    await Promise.all([...streams]);
    await retire(room);
    stopLocal?.();
    stopCloseGuard?.();
    replica?.dispose();
    listeners.clear();
  };
  const pump = async () => {
    while (!disposed) {
      if (!open && !replica?.pending()) return;
      if (!room) await join();
      const active = room;
      if (!active) continue;
      const batch = replica!.capture();
      if (batch.update) {
        const snapshot = await input.client.submit({ ...address(active), update: batch.update });
        replica!.acknowledge(batch.count, snapshot);
        active.seedId = snapshot.seedId;
        active.sourceSeedId = snapshot.sourceSeedId;
        publish({ error: undefined });
        continue;
      }
      if (active.seedId !== replica!.seedId) {
        await rebase(active);
        continue;
      }
      publish();
      return;
    }
  };
  function drive() {
    if (disposed) return Promise.reject(new Error("Native document session is closed"));
    requested = true;
    if (operation) return operation;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    requested = false;
    operation = Promise.resolve()
      .then(pump)
      .then(async () => {
        if (closing && !replica?.pending()) await completeClose();
      })
      .catch((error) => {
        fail(error);
        throw error;
      })
      .finally(() => {
        operation = undefined;
        if (requested && !retryTimer && !disposed) background();
      });
    return operation;
  }
  return {
    /** Retained closed views keep their document and pending saves, but leave live presence. */
    setOpen(nextOpen: boolean) {
      if (disposed || open === nextOpen) return;
      open = nextOpen;
      if (!open) {
        watch?.abort();
        presence.disconnect();
        publish({ connected: false });
        return;
      }
      if (room) startWatch(room);
      background();
    },
    setSelection: presence.setSelection,
    start: drive,
    flush: drive,
    retry: drive,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async close() {
      if (disposed) return;
      closing = true;
      if (!replica && !operation) {
        await completeClose();
        return;
      }
      try {
        await drive();
      } catch (error) {
        if (!replica?.pending()) {
          await completeClose();
          return;
        }
        schedule();
        throw error;
      }
    },
  };
};

export type NativeDocumentSession = ReturnType<typeof createNativeDocumentSession>;
