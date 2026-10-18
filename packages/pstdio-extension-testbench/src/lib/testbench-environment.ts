import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createMemoryResources, createMemoryStorage } from "@pstdio/sdk/testing";
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
  const files = createStorageFiles(seed.blobs);
  const wrap = (storage: CommandRunnerEnvironment["storage"]) => {
    const api: CommandRunnerEnvironment["storage"] = {
      ...storage,
      files,
      scope: (scope) => wrap(storage.scope(scope)),
      collection: (name) => ({ ...storage.collection(name), attachments: () => files }),
    };
    return api;
  };
  return wrap(createMemoryStorage(seed));
};

export const createBenchEnvironment = (
  seed?: BenchStorageSeed,
  prefixes: Record<string, string> = {},
): CommandRunnerEnvironment => {
  const queuedRequestsRequireHost = async () => {
    throw new Error("Queued requests require the host runtime.");
  };
  const environment: CommandRunnerEnvironment = {
    project: { id: "bench-project", name: "Bench Project", shorthand: "BP" },
    storage: createStorage(seed),
    resources: createMemoryResources(prefixes),
    artifacts: { mount: () => ({}) as never },
    packageFiles: {
      exists: async () => false,
      list: async () => [],
      listDirs: async () => [],
      readBytes: async () => new Uint8Array(),
      readText: async () => "",
    },
    files: {
      createText: async () => ({ id: crypto.randomUUID() }),
      delete: async () => {},
      readText: async () => "",
      writeText: async () => {},
    },
    sessions: {
      query: async () => ({ items: [], nextCursor: null }),
      addAnchors: async () => {},
      removeAnchors: async () => {},
      get: async () => null,
      create: async (input) => {
        const createdAt = new Date().toISOString();
        return {
          type: "session",
          id: crypto.randomUUID(),
          title: input.title,
          status: "in_progress",
          archived: false,
          agent: input.harness?.harnessId ?? null,
          cwd: null,
          usage: null,
          lastSelectedModel: input.harness?.model ?? null,
          workspaceId: input.workspaceId ?? null,
          originalSessionId: input.originalSessionId ?? null,
          createdAt,
          updatedAt: createdAt,
          lastRequestStarted: createdAt,
          lastRequestEnded: null,
          last_selected_model: input.harness?.model ?? null,
          workspace_id: input.workspaceId ?? null,
          original_session_id: input.originalSessionId ?? null,
          created_at: createdAt,
          updated_at: createdAt,
          last_request_started: createdAt,
          last_request_ended: null,
          anchors_json: input.anchors ?? [],
        };
      },
      followup: async () => {},
      getQueuedFollowUps: queuedRequestsRequireHost,
      updateQueuedFollowUp: queuedRequestsRequireHost,
      combineQueuedFollowUps: queuedRequestsRequireHost,
      steerQueuedFollowUp: queuedRequestsRequireHost,
    },
    workspaces: {
      addAnchors: async () => {},
      removeAnchors: async () => {},
      listProviders: async () => [],
      getDefault: async () => seed?.workspaces?.find((workspace) => workspace.is_default) ?? null,
      list: async () => seed?.workspaces ?? [],
      cancel: async (id) => ({ id }),
      create: async () => ({ id: crypto.randomUUID() }),
      delete: async () => {},
      get: async () => null,
      getByShorthand: async () => null,
      removeWorktree: async () => ({ removed: true }),
      resolve: async () => ({}) as never,
    },
    activity: { record: async () => ({ id: crypto.randomUUID() }) },
    notify: {
      setStatus: async () => null,
      setStatusByKey: async () => [],
      action: async () => ({}) as never,
      dismiss: async () => [],
      resolve: async () => [],
      toast: async () => {},
    },
    automation: {
      enqueue: async () => {
        throw new Error("Durable automation requires the host runtime.");
      },
      get: async () => undefined,
      list: async () => [],
      cancel: async () => {
        throw new Error("Durable automation requires the host runtime.");
      },
    },
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
    withScope: () => ({
      ...environment,
      sessions: environment.sessions,
      workspaces: environment.workspaces,
      connections: environment.connections,
      process: environment.process,
      terminal: environment.terminal,
    }),
  };
  return environment;
};
