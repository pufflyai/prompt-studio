import { extensionTransportName } from "pstdio-api-contracts/extension-identity";
import type { StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import { createLogStreamSync, type LogDirectoryEntry, type LogRemote, type LogStreamStore } from "pstdio-sync/logs";
import type { DocumentRelay, SubscribeDocument } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

type Entry = { documentId: string; remote: LogRemote; tail: Promise<unknown>; error?: unknown };

/** Installs one owner's lazy log transport; unopened histories never enter the ordinary document sweep. */
export const createRelayLogs = (input: {
  owner: StorageOwner;
  space: SyncSpace;
  service: ExtensionsRouteDeps["extensionStorageService"]["logs"];
  relay: (documentId: string) => DocumentRelay;
  signal: AbortSignal;
  subscribe?: SubscribeDocument;
  statusChanged?: () => void;
}) => {
  const entries = new Map<string, Promise<Entry>>();
  const documents = new Set<string>();
  let closed = false;
  const create = async (entry: LogDirectoryEntry, store: LogStreamStore) => {
    const documentId = await input.space.documentId(
      extensionTransportName(input.owner.extensionId, "append-log-v1", entry.name, entry.scope, entry.stream),
    );
    input.signal.throwIfAborted();
    if (closed) throw new Error("Log connection is closed");
    const relay = input.relay(documentId);
    let manifests: ReturnType<typeof input.service.manifests> | undefined;
    const sync = createLogStreamSync({
      space: input.space,
      documentId,
      relay,
      store,
      canCompact: entry.writer !== "device" || entry.stream === (await input.service.writerId()),
      manifestBlobs: async () => {
        if (!relay.manifestBlobs) throw new Error("Relay does not support log manifest references");
        manifests ??= input.service.manifests(input.owner, input.space, await relay.manifestBlobs());
        return manifests;
      },
    });
    const state: Entry = { documentId, remote: sync, tail: Promise.resolve() };
    const run = <T>(action: () => Promise<T>) => {
      const next = state.tail.then(async () => {
        input.signal.throwIfAborted();
        if (closed) throw new Error("Log connection is closed");
        try {
          const value = await action();
          state.error = undefined;
          return value;
        } catch (error) {
          state.error = error;
          throw error;
        } finally {
          input.statusChanged?.();
        }
      });
      state.tail = next.catch(() => {});
      return next;
    };
    state.remote = {
      publish: () => run(sync.publish),
      read: (options) => run(() => sync.read(options)),
      plan: (options) => run(() => sync.plan(options)),
      compact: () => run(sync.compact),
    };
    documents.add(documentId);
    input.subscribe?.(input.space.spaceOwner, documentId);
    return state;
  };
  const detach = input.service.attach(input.owner, async (entry, store) => {
    const key = JSON.stringify([entry.name, entry.scope, entry.stream]);
    let current = entries.get(key);
    if (!current) {
      current = create(entry, store);
      entries.set(key, current);
    }
    return (await current).remote;
  });
  return {
    async publish() {
      input.signal.throwIfAborted();
      await input.service.publish(input.owner);
      // Owner directory changes can reveal a new device stream to an active follower.
      input.service.notify(input.owner);
    },
    has: (documentId: string) => documents.has(documentId),
    changed(documentId: string) {
      if (!documents.has(documentId)) return false;
      input.service.notify(input.owner);
      return true;
    },
    async status() {
      const initialized = await Promise.all([...entries.values()]);
      return {
        downloaded: true,
        pending: await input.service.pending(input.owner),
        needsAttention: initialized.some((entry) => entry.error !== undefined),
      };
    },
    async close() {
      closed = true;
      detach();
      await Promise.allSettled([...entries.values()].map(async (entry) => (await entry).tail));
      entries.clear();
      documents.clear();
    },
  };
};
