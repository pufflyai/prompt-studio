import type { CommandContext, ExtensionResourcesApi, ExtensionStorageApi } from "pstdio-api-contracts/extension-kernel";
import { createMemoryRepoFiles } from "./memory-repo-files";

const unavailable = (): never => {
  throw new Error("Provide a test override for this host operation.");
};

export const createCommandContextDefaults = (input: {
  projectId: string;
  storage: ExtensionStorageApi;
  resources: ExtensionResourcesApi;
}) => {
  const { projectId, storage, resources } = input;
  const settings: Record<string, unknown> = {};
  const mounts = new Map<string, ReturnType<typeof createMemoryRepoFiles>>();
  const mount = (key: string) => {
    let files = mounts.get(key);
    if (!files) {
      files = createMemoryRepoFiles();
      mounts.set(key, files);
    }
    return files;
  };
  const coreResource = (type: string, id: string) => ({ type, id, extensionId: "pstdio" });
  const base = {
    extensionId: "test.extension",
    name: "test-extension",
    projectId,
    project: { id: projectId, name: "Test Project", shorthand: "T" },
    storage,
    resources,
    commandId: "test.extension.command.test",
    invocationId: crypto.randomUUID(),
    signal: new AbortController().signal,
    invocation: {},
    stream: { write: async () => {} },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    settings: {
      all: async () => ({ ...settings }),
      get: async (key) => settings[key],
      set: async (key, value) => {
        settings[key] = value;
      },
      delete: async (key) => {
        delete settings[key];
      },
    },
    navigation: { open: () => {} },
    events: { emit: async () => ({ delivered: 0 }) },
    notify: {
      setStatus: unavailable,
      setStatusByKey: unavailable,
      action: unavailable,
      dismiss: async () => [],
      resolve: async () => [],
      toast: async () => {},
    },
    views: {
      list: unavailable,
      create: unavailable,
      update: unavailable,
      remove: unavailable,
      reorder: unavailable,
      setDefault: unavailable,
    },
    artifacts: { mount },
    packageFiles: mount("package"),
    projectFiles: mount("project"),
    extensionFiles: mount("extension"),
    files: {
      readText: (id) => mount("files").readText(id),
      writeText: (id, text) => mount("files").writeText(id, text),
      createText: async ({ content }) => {
        const id = crypto.randomUUID();
        await mount("files").writeText(id, content);
        return { id };
      },
      delete: (id) => mount("files").delete(id),
    },
    skills: { list: async () => [] },
    workspaces: {
      addAnchors: async (id, anchors) => {
        await resources.addAnchors(coreResource("workspace", id), anchors);
      },
      removeAnchors: async (id, refs) => {
        await resources.removeAnchors(coreResource("workspace", id), refs);
      },
      listProviders: async () => [],
      getDefault: async () => null,
      list: async () => [],
      get: async () => null,
      getByShorthand: async () => null,
      create: unavailable,
      resolve: unavailable,
      cancel: unavailable,
      removeWorktree: unavailable,
      delete: unavailable,
    },
    sessions: {
      getConversation: unavailable,
      getConversationSources: unavailable,
      getQueuedMessages: unavailable,
      stream: unavailable,
      retainResources: unavailable,
      approve: unavailable,
      rename: unavailable,
      archive: unavailable,
      delete: unavailable,
      updateStatus: unavailable,
      listActivity: unavailable,
      removeQueuedFollowUp: unavailable,
      moveQueuedFollowUp: unavailable,
      getDraftHarnessCommands: unavailable,
      getHarnessCommands: unavailable,
      invokeHarnessOperation: unavailable,
      resolveSessionId: unavailable,
      uploadAttachment: unavailable,
      readAttachment: unavailable,
      deleteAttachment: unavailable,
      query: async () => ({ items: [], nextCursor: null }),
      get: async () => null,
      create: unavailable,
      followup: unavailable,
      stop: unavailable,
      addAnchors: async (id, anchors) => {
        await resources.addAnchors(coreResource("session", id), anchors);
      },
      removeAnchors: async (id, refs) => {
        await resources.removeAnchors(coreResource("session", id), refs);
      },
      getQueuedFollowUps: unavailable,
      updateQueuedFollowUp: unavailable,
      combineQueuedFollowUps: unavailable,
      steerQueuedFollowUp: unavailable,
    },
    activity: { record: async () => ({ id: crypto.randomUUID() }) },
    automation: { enqueue: unavailable, get: async () => undefined, list: async () => [], cancel: unavailable },
    // A signed-out device: every project is local until a test overrides the account.
    account: {
      status: async () => ({ login: null, cloudProjects: [], cloudProjectsLoaded: true, features: null }),
      login: unavailable,
      loginStatus: unavailable,
      cancelLogin: unavailable,
      logout: unavailable,
      devices: unavailable,
      renameDevice: unavailable,
      removeDevice: unavailable,
      projectSyncStatus: async () => ({ state: "local", offlineReady: false }),
      syncProject: unavailable,
      stopProjectSync: unavailable,
    },
    process: { run: unavailable, runOrThrow: unavailable, spawnDetached: unavailable },
    net: { findFreePort: unavailable },
    connections: { request: unavailable, stream: unavailable },
    commands: {
      execute: unavailable,
      continue: () => ({ type: "continue" }),
      patchParams: (params) => ({ type: "patchParams", params }),
      replaceParams: (params) => ({ type: "replaceParams", params }),
      replaceInvocation: (invocation) => ({ type: "replaceInvocation", invocation }),
      reject: (value) => ({ type: "reject", ...value }),
    },
  } satisfies CommandContext;
  return base;
};
