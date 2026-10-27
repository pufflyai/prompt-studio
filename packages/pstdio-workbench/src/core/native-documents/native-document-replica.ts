import type { NativeDocumentSnapshot } from "@pstdio/sdk/client";
import * as Y from "yjs";

/** Received history stays separate from unacknowledged local frames during reconnect. */
export const createNativeDocumentReplica = (initial: NativeDocumentSnapshot) => {
  const document = new Y.Doc({ gc: false });
  const received = new Y.Doc({ gc: false });
  const hostOrigin = Symbol("native-document-host");
  const frames: Uint8Array[] = [];
  const listeners = new Set<() => void>();
  Y.applyUpdate(document, initial.state);
  Y.applyUpdate(received, initial.state);
  const local = (update: Uint8Array, origin: unknown) => {
    if (origin === hostOrigin) return;
    frames.push(update);
    for (const listener of listeners) listener();
  };
  document.on("update", local);
  const receive = (snapshot: NativeDocumentSnapshot) => {
    const sameHistory = snapshot.seedId === initial.seedId;
    const source = sameHistory ? snapshot.state : snapshot.sourceState;
    if (source && (sameHistory || snapshot.sourceSeedId === initial.seedId)) {
      Y.applyUpdate(received, source);
      Y.applyUpdate(document, source, hostOrigin);
    }
    return sameHistory;
  };
  return {
    document,
    seedId: initial.seedId,
    receive,
    receivedState: () => Y.encodeStateAsUpdate(received),
    pending: () => frames.length > 0,
    capture: () => ({ count: frames.length, update: frames.length ? Y.mergeUpdates(frames) : undefined }),
    acknowledge(count: number, snapshot: NativeDocumentSnapshot) {
      frames.splice(0, count);
      return receive(snapshot);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      document.off("update", local);
      listeners.clear();
      document.destroy();
      received.destroy();
    },
  };
};
