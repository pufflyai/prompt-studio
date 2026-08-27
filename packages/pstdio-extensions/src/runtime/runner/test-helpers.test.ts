import type { ExtensionRuntime } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "../normalize";
import { type CommandRunnerEnvironment, createCommandRunner } from "./runner";

export const makeStorage = () => {
  const state = new Map<string, unknown>();
  const api: CommandRunnerEnvironment["storage"] = {
    scope: () => api,
    files: {
      put: async () => ({}) as never,
      get: async () => undefined,
      getBytes: async () => new Uint8Array(),
      list: async () => [],
      delete: async () => {},
      urlFor: () => "",
    },
    get: async (key) => state.get(String(key)) as never,
    set: async (key, value) => {
      state.set(String(key), value);
    },
    delete: async (key) => {
      state.delete(String(key));
    },
    collection: () => {
      throw new Error("collection not implemented in test");
    },
  };
  return { api, state };
};

const createSessionResource = () => ({ type: "session" as const, id: "", title: "", status: "in_progress" as const });

export const stubEnvironment = (storage: CommandRunnerEnvironment["storage"]): CommandRunnerEnvironment => {
  const environment: CommandRunnerEnvironment = {
    project: { id: "p1", name: "Prompt Studio", shorthand: "PS" },
    storage,
    artifacts: { mount: () => ({}) as never },
    packageFiles: {
      exists: async () => false,
      readText: async () => "",
      readBytes: async () => new Uint8Array(),
      list: async () => [],
      listDirs: async () => [],
    },
    files: {
      readText: async () => "",
      writeText: async () => {},
      createText: async () => ({ id: "" }),
      delete: async () => {},
    },
    sessions: {
      get: async () => null,
      list: async () => [],
      listByWorkspace: async () => [],
      create: async () => createSessionResource(),
      followup: async () => {},
      addAnchors: async () => {},
    },
    workspaces: {
      list: async () => [],
      get: async () => null,
      getByShorthand: async () => null,
      create: async () => ({ id: "" }),
      resolve: async () => ({}) as never,
      cancel: async () => ({ id: "" }),
      archive: async () => ({ id: "" }),
      removeWorktree: async () => ({ removed: true }),
      delete: async () => {},
    },
    repos: {
      list: async () => [],
      get: async () => ({}) as never,
      getDefault: async () => undefined,
      resolvePath: async (_repoId, relativePath) => relativePath,
    },
    activity: { record: async () => ({ id: "" }) },
    notify: {
      toast: async () => {},
      action: async () => ({}) as never,
      resolve: async () => [],
      dismiss: async () => [],
    },
    process: {
      run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      spawnDetached: async () => ({}),
    },
    net: { findFreePort: async () => 0 },
    settings: {
      all: async () => ({}),
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
    },
    withSignal: () => ({ sessions: environment.sessions, workspaces: environment.workspaces }),
  };
  return environment;
};

export const buildRuntime = (definition: LoadedExtensionSource["definition"]): ExtensionRuntime =>
  normalizeExtensionSources([
    {
      packagePath: "/tmp/lab",
      sourcePath: "/tmp/lab/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "pstdio.lab",
        name: "lab",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition,
    },
  ]);

export const makeRunner = (
  definition: LoadedExtensionSource["definition"],
  opts: { maxDepth?: number; onDidDispatchEvent?: (eventId: string) => void } = {},
) => {
  const runtime = buildRuntime(definition);
  const { api: storage } = makeStorage();
  return createCommandRunner(runtime, {
    buildEnvironment: () => stubEnvironment(storage),
    maxDepth: opts.maxDepth,
    onDidDispatchEvent: opts.onDidDispatchEvent,
  });
};
