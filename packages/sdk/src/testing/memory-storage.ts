import {
  createDataMigrationRunner,
  createStorageId,
  createStorageMigration,
  createStoragePositions,
} from "pstdio-api-contracts";
import type {
  ExtensionBlobRef,
  ExtensionBlobsApi,
  ExtensionStorageApi,
  ExtensionStorageCollectionApi,
  JsonObject,
  StorageScope,
} from "pstdio-api-contracts/extension-kernel";
import { createMemoryAssets } from "./memory-assets";
import { createMemoryRecordOwner, type MemoryStorageSeed } from "./memory-record-owner";

export type { MemoryStorageSeed } from "./memory-record-owner";

interface MemoryStorageOptions extends MemoryStorageSeed {
  /** Reuse these owner IDs to simulate the same extension and workbench on two devices. */
  workbenchId?: string;
  extensionId?: string;
  deviceId?: string;
  legacyData?: Record<string, { version: string; records: JsonObject[] }>;
}

export const createMemoryStorage = (options: MemoryStorageOptions = {}): ExtensionStorageApi => {
  const assets = createMemoryAssets();
  const owner = createMemoryRecordOwner(assets, options, {
    workbenchId: options.workbenchId ?? crypto.randomUUID(),
    extensionId: options.extensionId ?? "test-extension",
  });
  const positions = createStoragePositions(options.deviceId ?? crypto.randomUUID());
  const blobStores = new Map<string, Map<string, ExtensionBlobRef & { data: Uint8Array }>>();
  const migrations = new Map<string, ReturnType<typeof createDataMigrationRunner>>();
  const migrateFor = (scope: string) => {
    const existing = migrations.get(scope);
    if (existing) return existing;
    const migrate = createDataMigrationRunner({
      readVersion: () => owner.dataVersion(scope),
      writeVersion: (next) => owner.setDataVersion(scope, next),
    });
    migrations.set(scope, migrate);
    return migrate;
  };

  const blobStore = (name: string) => {
    const existing = blobStores.get(name);
    if (existing) return existing;
    const created = new Map<string, ExtensionBlobRef & { data: Uint8Array }>();
    blobStores.set(name, created);
    return created;
  };

  const blobsApi = (name: string): ExtensionBlobsApi => {
    const store = blobStore(name);
    return {
      async put(input) {
        const id = crypto.randomUUID();
        const data = input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data);
        const ref = {
          id,
          name: input.name,
          mimeType: input.mimeType ?? null,
          size: data.byteLength,
          hash: null,
          url: `memory://${id}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.set(id, { ...ref, data });
        return ref;
      },
      async get(id) {
        const stored = store.get(id);
        if (!stored) return undefined;
        const { data: _data, ...ref } = stored;
        return ref;
      },
      async getBytes(id) {
        const stored = store.get(id);
        if (!stored) throw new Error(`File not found: ${id}`);
        return stored.data;
      },
      async list() {
        return [...store.values()].map(({ data: _data, ...ref }) => ref);
      },
      async delete(id) {
        store.delete(id);
      },
      urlFor(id) {
        return `memory://${id}`;
      },
    };
  };

  const scopedApi = (scopeType: string, scopeId: string) => {
    const { records, legacy } = owner.scope(scopeType, scopeId);
    const blobKey = JSON.stringify([scopeType, scopeId]);
    const api: ExtensionStorageApi = {
      migrate: (version, run) =>
        migrateFor(blobKey)(version, (previous) =>
          owner.duringMigration(JSON.stringify([owner.extensionId, scopeType, scopeId, version]), () =>
            run(previous, createStorageMigration([owner.extensionId, owner.workbenchId, scopeType, scopeId, version])),
          ),
        ),
      ids: { create: createStorageId },
      positions,
      readLegacy: async (source) => structuredClone(options.legacyData?.[source]),
      records,
      assets,
      files: blobsApi(blobKey),
      scope(scope: StorageScope) {
        if (scope.type === "project") return scopedApi("project", owner.workbenchId);
        if (scope.type === "resource" && "resource" in scope) return scopedApi("resource", scope.resource.id);
        if (!("id" in scope)) throw new Error("Storage scope requires an ID");
        return scopedApi(scope.type, scope.id);
      },
      async get(key) {
        return (await legacy.kv.get(key)) as never;
      },
      async set(key, value) {
        await legacy.kv.set(key, value as never);
      },
      async delete(key) {
        await legacy.kv.delete(key);
      },
      collection<TItem>(name: string): ExtensionStorageCollectionApi<TItem> {
        const store = legacy.collection(name);
        return {
          async get(id) {
            return (await store.get(id))?.value as TItem | undefined;
          },
          async list() {
            return (await store.list()).map((record) => record.value) as TItem[];
          },
          async put(id, value) {
            await store.set(id, value as never);
          },
          async update(id, value) {
            if (!(await store.update(id, value as never))) throw new Error(`Item not found: ${id}`);
          },
          async createIfAbsent(id, value) {
            return store.createIfAbsent(id, value as never);
          },
          async deleteIfValue(id, value) {
            return store.deleteIfValue(id, value as never);
          },
          async create(value) {
            const id = crypto.randomUUID();
            await store.set(id, value as never);
            return { ...(typeof value === "object" && value !== null ? value : {}), id } as TItem & { id: string };
          },
          async delete(id) {
            await store.delete(id);
          },
          attachments(itemId) {
            return blobsApi(JSON.stringify([blobKey, name, itemId]));
          },
        };
      },
    };
    return api;
  };

  return scopedApi("project", owner.workbenchId);
};
