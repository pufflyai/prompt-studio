import type {
  ExtensionBlobRef,
  ExtensionBlobsApi,
  ExtensionStorageApi,
  ExtensionStorageCollectionApi,
  StorageScope,
} from "@pstdio/sdk/extensions";

export const createMemoryStorage = (): ExtensionStorageApi => {
  const kv = new Map<string, unknown>();
  const collections = new Map<string, Map<string, unknown>>();
  const blobStores = new Map<string, Map<string, ExtensionBlobRef & { data: Uint8Array }>>();

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

  const api: ExtensionStorageApi = {
    files: blobsApi("project"),
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
          return blobsApi(`${name}:${itemId}`);
        },
      };
    },
  };

  return api;
};
