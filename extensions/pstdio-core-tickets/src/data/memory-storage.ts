import type { ExtensionStorageApi, ExtensionStorageCollectionApi, StorageScope } from "@pstdio/sdk/extensions";

// Faithful in-memory implementation of the extension storage runtime, used by
// tests to exercise the real data layer without a database. Mirrors the runtime
// semantics: create() generates an id and stores the value *without* it.
export const createMemoryStorage = (): ExtensionStorageApi => {
  const kv = new Map<string, unknown>();
  const collections = new Map<string, Map<string, unknown>>();

  const collectionStore = (name: string) => {
    const existing = collections.get(name);
    if (existing) return existing;
    const created = new Map<string, unknown>();
    collections.set(name, created);
    return created;
  };

  const api: ExtensionStorageApi = {
    scope(_scope: StorageScope) {
      return api;
    },
    async get(key) {
      return kv.get(key) as never;
    },
    async set(key, value) {
      kv.set(key, value);
    },
    async delete(key) {
      kv.delete(key);
    },
    collection<TItem>(name: string): ExtensionStorageCollectionApi<TItem> {
      const store = collectionStore(name);
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
        async create(value) {
          const id = crypto.randomUUID();
          store.set(id, value);
          return { ...(typeof value === "object" && value !== null ? value : {}), id } as TItem & { id: string };
        },
        async delete(id) {
          store.delete(id);
        },
      };
    },
  };

  return api;
};
