import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import type { CommandRunnerEnvironment } from "pstdio-extensions";

export type BenchStorageSeed = {
  collections?: Record<string, Record<string, unknown>>;
  kv?: Record<string, unknown>;
  // Blob bytes keyed by id, base64-encoded. Lets the preview seed attachment
  // bytes that command-side getBytes can read (the webview file store is a
  // separate, client-side store, mirroring production's split).
  blobs?: Record<string, { name: string; mimeType: string | null; base64: string }>;
  // Workspaces the host exposes through ctx.workspaces.list(), so ticket-mode
  // views that link workspaces to a ticket can be exercised in the bench.
  workspaces?: ExtensionWorkspace[];
};

const base64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const blobRef = (id: string, name = id) => ({
  id,
  name,
  mimeType: "text/plain",
  size: 0,
  hash: null,
  url: `bench://files/${encodeURIComponent(id)}`,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

const createStorageFiles = (seedBlobs?: BenchStorageSeed["blobs"]): CommandRunnerEnvironment["storage"]["files"] => {
  const files = new Map<string, Uint8Array>();
  for (const [id, blob] of Object.entries(seedBlobs ?? {})) files.set(id, base64ToBytes(blob.base64));

  return {
    async put(input) {
      const id = crypto.randomUUID();
      files.set(id, input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data));
      return { ...blobRef(id, input.name), mimeType: input.mimeType ?? null, size: files.get(id)?.byteLength ?? 0 };
    },
    async get(id) {
      return files.has(id) ? blobRef(id) : undefined;
    },
    async getBytes(id) {
      return files.get(id) ?? new Uint8Array();
    },
    async list() {
      return [...files.keys()].map((id) => blobRef(id));
    },
    async delete(id) {
      files.delete(id);
    },
    urlFor(id) {
      return `bench://files/${encodeURIComponent(id)}`;
    },
  };
};

const createStorage = (seed: BenchStorageSeed = {}): CommandRunnerEnvironment["storage"] => {
  const kv = new Map(Object.entries(seed.kv ?? {}));
  const collections = new Map<string, Map<string, unknown>>();

  for (const [name, values] of Object.entries(seed.collections ?? {})) {
    collections.set(name, new Map(Object.entries(values)));
  }

  const collectionMap = (name: string) => {
    const existing = collections.get(name);
    if (existing) return existing;
    const next = new Map<string, unknown>();
    collections.set(name, next);
    return next;
  };

  const api: CommandRunnerEnvironment["storage"] = {
    files: createStorageFiles(seed.blobs),
    scope: () => api,
    async get(key) {
      return kv.get(key) as never;
    },
    async set(key, value) {
      kv.set(key, value);
    },
    async delete(key) {
      kv.delete(key);
    },
    collection(name) {
      const items = collectionMap(name);
      return {
        attachments: () => api.files,
        async create(value) {
          const id = crypto.randomUUID();
          const next = typeof value === "object" && value !== null ? { ...value, id } : { id, value };
          items.set(id, next);
          return next as never;
        },
        async delete(id) {
          items.delete(id);
        },
        async get(id) {
          return items.get(id) as never;
        },
        async list() {
          return [...items.values()] as never;
        },
        async put(id, value) {
          items.set(id, value);
        },
      };
    },
  };

  return api;
};

export const createBenchEnvironment = (seed?: BenchStorageSeed): CommandRunnerEnvironment => ({
  project: { id: "bench-project", name: "Bench Project", shorthand: "BP" },
  storage: createStorage(seed),
  artifacts: { mount: () => ({}) as never },
  files: {
    createText: async () => ({ id: crypto.randomUUID() }),
    delete: async () => {},
    readText: async () => "",
    writeText: async () => {},
  },
  sessions: {
    get: async () => null,
    create: async (input) => ({
      type: "session",
      id: crypto.randomUUID(),
      title: input.title,
      status: "in_progress",
    }),
    followup: async () => {},
  },
  workspaces: {
    list: async () => seed?.workspaces ?? [],
    archive: async () => {},
    create: async () => ({ id: crypto.randomUUID() }),
    delete: async () => {},
    get: async () => null,
    getByShorthand: async () => null,
  },
  worktrees: {
    bootstrap: async () => {},
  },
  repos: {
    get: async () => ({}) as never,
    getDefault: async () => undefined,
    list: async () => [],
    resolvePath: async (_repoId, relativePath) => relativePath,
  },
  activity: { record: async () => ({ id: crypto.randomUUID() }) },
  notify: { toast: async () => {} },
  process: {
    run: async () => ({ exitCode: 0, stderr: "", stdout: "" }),
    runOrThrow: async () => ({ exitCode: 0, stderr: "", stdout: "" }),
    spawnDetached: async () => ({ pid: 0 }),
  },
  net: { findFreePort: async () => 0 },
  settings: {
    all: async () => ({}),
    delete: async () => {},
    get: async () => undefined,
    set: async () => {},
  },
});
