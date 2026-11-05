import type { DocumentStore, StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import { createLogCollection, type LogDirectoryEntry, type LogRemote, type LogStreamStore } from "pstdio-sync/logs";
import type { OrderedIndexBlobs } from "pstdio-sync/relay";
import type { Json, StorageLogDefinition } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { createEnvironmentDBService } from "../environment/environment";
import type { LogPayloads } from "./ordered-log-sql";
import { orderedLogStatistics } from "./ordered-log-statistics";
import { createOrderedLogStore } from "./ordered-log-store";
import { createOrderedManifestCache } from "./ordered-receipts-blobs";

type Connector = (entry: LogDirectoryEntry, store: LogStreamStore) => Promise<LogRemote>;
const ownerKey = (owner: StorageOwner) => JSON.stringify([owner.workbenchId, owner.extensionId]);
const entryKey = (entry: LogDirectoryEntry) => JSON.stringify([entry.name, entry.scope, entry.stream]);

/** The encrypted owner directory discovers device streams; payload histories stay out of that document. */
export const createOrderedLogs = (
  db: DbClient,
  deps: { metadata: DocumentStore["transaction"]; changed: (owner: StorageOwner) => void },
) => {
  const environment = createEnvironmentDBService(db);
  const connectors = new Map<string, Connector>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (owner: StorageOwner) => {
    for (const listener of listeners.get(ownerKey(owner)) ?? []) listener();
  };
  const changed = (owner: StorageOwner) => {
    notify(owner);
    deps.changed(owner);
  };
  const directory = (owner: StorageOwner) =>
    deps.metadata(owner, async ({ document }) => {
      const entries = [...document.getMap<LogDirectoryEntry>("append-logs").values()];
      for (const entry of entries)
        if (
          !entry ||
          typeof entry.name !== "string" ||
          typeof entry.scope !== "string" ||
          typeof entry.stream !== "string" ||
          (entry.writer !== "project" && entry.writer !== "device")
        )
          throw new Error("Invalid encrypted log directory");
      return entries.map((entry) => structuredClone(entry));
    });
  const stream = async (owner: StorageOwner, entry: LogDirectoryEntry, payloads?: LogPayloads) =>
    createOrderedLogStore(db, {
      owner,
      name: entry.name,
      scope: entry.scope,
      stream: entry.stream,
      writerId: (await environment.get()).environmentId,
      keep: entry.keep,
      payloads,
      changed: () => changed(owner),
    });
  const register = (owner: StorageOwner, entry: LogDirectoryEntry) =>
    deps.metadata(owner, async ({ document }) => {
      const map = document.getMap<LogDirectoryEntry>("append-logs");
      const key = entryKey(entry);
      if (JSON.stringify(map.get(key)) !== JSON.stringify(entry)) map.set(key, structuredClone(entry));
    });
  const watch = (owner: StorageOwner, listener: () => void) => {
    const key = ownerKey(owner);
    const callbacks = listeners.get(key) ?? new Set();
    callbacks.add(listener);
    listeners.set(key, callbacks);
    return () => {
      callbacks.delete(listener);
      if (!callbacks.size) listeners.delete(key);
    };
  };
  return {
    async appendMany(owner: StorageOwner, definition: StorageLogDefinition, scope: string, values: Json[]) {
      if (!values.length) return [];
      const owned = structuredClone({ ...definition, writer: definition.writer ?? "project" });
      const entry = { ...owned, scope, stream: owned.writer === "device" ? await this.writerId() : "project" };
      await register(owner, entry);
      return (await stream(owner, entry)).appendMany(values.map((value) => ({ value })));
    },
    flushStatistics: orderedLogStatistics(db).flush,
    writerId: async () => (await environment.get()).environmentId,
    directory,
    stream,
    notify,
    watch,
    manifests: (owner: StorageOwner, space: SyncSpace, remote: OrderedIndexBlobs) =>
      createOrderedManifestCache(db, owner, space, remote).blobs,
    attach(owner: StorageOwner, connector: Connector) {
      const key = ownerKey(owner);
      connectors.set(key, connector);
      notify(owner);
      return () => {
        if (connectors.get(key) === connector) connectors.delete(key);
      };
    },
    async publish(owner: StorageOwner) {
      const connector = connectors.get(ownerKey(owner));
      if (!connector) return;
      for (const entry of await directory(owner)) {
        const store = await stream(owner, entry);
        if ((await store.pending(1)).length) await (await connector(entry, store)).publish();
      }
    },
    async pending(owner: StorageOwner) {
      for (const entry of await directory(owner))
        if ((await (await stream(owner, entry)).pending(1)).length) return true;
      return false;
    },
    open(
      owner: StorageOwner,
      definition: StorageLogDefinition,
      scope: string,
      selected?: () => ReadonlySet<string> | undefined,
    ) {
      const owned = structuredClone({ ...definition, writer: definition.writer ?? "project" });
      return createLogCollection({
        address: JSON.stringify([owner.workbenchId, owner.extensionId, definition.name, scope]),
        definition: owned,
        scope,
        writerId: async () => (await environment.get()).environmentId,
        directory: async () => {
          const allowed = selected?.();
          const entries = await directory(owner);
          return allowed ? entries.filter((entry) => allowed.has(entry.stream)) : entries;
        },
        register: (entry) => register(owner, entry),
        open: (entry) => stream(owner, { ...entry, ...owned, scope }),
        remote: async (entry, store) => connectors.get(ownerKey(owner))?.(entry, store),
        watch: (listener) => watch(owner, listener),
      });
    },
  };
};
