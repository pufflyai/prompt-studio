import { createDataMigrationRunner } from "pstdio-api-contracts";
import type {
  ExtensionBlobRef,
  ExtensionBlobsApi,
  ExtensionStorageApi,
  ExtensionStorageCollectionApi,
  JsonObject,
  StorageScope,
} from "pstdio-api-contracts/extension-kernel";

interface MemoryStorageOptions {
  legacyData?: Record<string, { version: string; records: JsonObject[] }>;
}

export const createMemoryStorage = (options: MemoryStorageOptions = {}): ExtensionStorageApi => {
  const kv = new Map<string, unknown>();
  const collections = new Map<string, Map<string, unknown>>();
  const blobStores = new Map<string, Map<string, ExtensionBlobRef & { data: Uint8Array }>>();
  const migrations = new Map<string, ReturnType<typeof createDataMigrationRunner>>();
  const migrateFor = (scope: string) => {
    const existing = migrations.get(scope);
    if (existing) return existing;
    let version = 0;
    const migrate = createDataMigrationRunner({
      readVersion: async () => version,
      writeVersion: async (next) => {
        version = next;
      },
    });
    migrations.set(scope, migrate);
    return migrate;
  };

  const collectionStore = (name: string) => {
    const existing = collections.get(name);
    if (existing) return existing;
    const created = new Map<string, unknown>();
    collections.set(name, created);
    return created;
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

  const createScopedApi = (prefix: string): ExtensionStorageApi => ({
    migrate: migrateFor(prefix),
    readLegacy: async (source) => structuredClone(options.legacyData?.[source]),
    files: blobsApi(prefix),
    scope(scope: StorageScope) {
      if (scope.type === "project") return createScopedApi("project");
      let id: string | undefined;
      if ("resource" in scope) id = scope.resource.id;
      else if ("id" in scope) id = scope.id;
      if (!id) throw new Error("Storage scope requires an id.");
      return createScopedApi(JSON.stringify([scope.type, id]));
    },
    async get(key) {
      return kv.get(JSON.stringify([prefix, key])) as never;
    },
    async set(key, value) {
      kv.set(JSON.stringify([prefix, key]), value);
    },
    async delete(key) {
      kv.delete(JSON.stringify([prefix, key]));
    },
    collection<TItem>(name: string): ExtensionStorageCollectionApi<TItem> {
      const store = collectionStore(JSON.stringify([prefix, name]));
      return {
        async get(id) {
          return store.get(id) as TItem | undefined;
        },
        async list() {
          return [...store.values()] as TItem[];
        },
        async put(id, value) {
          store.set(id, value);
        },
        async update(id, value) {
          if (!store.has(id)) throw new Error(`Item not found: ${id}`);
          store.set(id, value);
        },
        async createIfAbsent(id, value) {
          if (store.has(id)) return false;
          store.set(id, value);
          return true;
        },
        async deleteIfValue(id, value) {
          if (store.get(id) !== value && JSON.stringify(store.get(id)) !== JSON.stringify(value)) return false;
          return store.delete(id);
        },
        async create(value) {
          const id = crypto.randomUUID();
          store.set(id, value);
          return { ...(typeof value === "object" && value !== null ? value : {}), id } as TItem & { id: string };
        },
        async delete(id) {
          store.delete(id);
        },
        attachments(itemId) {
          return blobsApi(JSON.stringify([prefix, name, itemId]));
        },
      };
    },
  });

  return createScopedApi("project");
};
