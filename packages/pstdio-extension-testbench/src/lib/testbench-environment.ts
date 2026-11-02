import type {
  ExtensionBlobInput,
  ExtensionBlobRef,
  ExtensionWorkspace,
  ResourceIdentity,
} from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { createBenchResources } from "./testbench-resources";

export type BenchStorageSeed = {
  collections?: Record<string, Record<string, unknown>>;
  kv?: Record<string, unknown>;
  resourceIdentities?: ResourceIdentity[];
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
  const files = new Map<string, { bytes: Uint8Array; ref: ExtensionBlobRef }>();
  for (const [id, blob] of Object.entries(seedBlobs ?? {})) {
    const bytes = base64ToBytes(blob.base64);
    files.set(id, { bytes, ref: { ...blobRef(id, blob.name), mimeType: blob.mimeType, size: bytes.length } });
  }
  const write = (id: string, input: ExtensionBlobInput, previous: ExtensionBlobRef = blobRef(id, input.name)) => {
    const bytes = input.data instanceof Uint8Array ? input.data.slice() : new Uint8Array(input.data.slice(0));
    const ref = {
      ...previous,
      name: input.name,
      mimeType: input.mimeType ?? null,
      size: bytes.length,
      updatedAt: new Date().toISOString(),
    };
    files.set(id, { bytes, ref });
    return ref;
  };

  return {
    async put(input) {
      return write(crypto.randomUUID(), input);
    },
    async update(id, input) {
      const previous = files.get(id);
      if (!previous) throw new Error("File not found");
      return write(id, input, previous.ref);
    },
    async get(id) {
      return files.get(id)?.ref;
    },
    async getBytes(id) {
      return files.get(id)?.bytes ?? new Uint8Array();
    },
    async list() {
      return [...files.values()].map((file) => file.ref);
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
    resources: createBenchResources(prefixes, seed?.resourceIdentities),
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
      getConversation: queuedRequestsRequireHost,
      getConversationSources: queuedRequestsRequireHost,
      getQueuedMessages: queuedRequestsRequireHost,
      stream: queuedRequestsRequireHost,
      retainResources: queuedRequestsRequireHost,
      approve: queuedRequestsRequireHost,
      rename: queuedRequestsRequireHost,
      archive: queuedRequestsRequireHost,
      delete: queuedRequestsRequireHost,
      updateStatus: queuedRequestsRequireHost,
      listActivity: queuedRequestsRequireHost,
      removeQueuedFollowUp: queuedRequestsRequireHost,
      moveQueuedFollowUp: queuedRequestsRequireHost,
      getDraftHarnessCommands: queuedRequestsRequireHost,
      getHarnessCommands: queuedRequestsRequireHost,
      invokeHarnessOperation: queuedRequestsRequireHost,
      resolveSessionId: queuedRequestsRequireHost,
      uploadAttachment: queuedRequestsRequireHost,
      readAttachment: queuedRequestsRequireHost,
      deleteAttachment: queuedRequestsRequireHost,
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
      stop: async () => {},
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
