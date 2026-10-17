import { createMemoryResources, createMemoryStorage } from "@pstdio/sdk/testing";
import type { ExtensionRuntime } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "../normalize";
import { type CommandRunnerEnvironment, createCommandRunner } from "./runner";

export const makeStorage = () => ({ api: createMemoryStorage() });

const createSessionResource = () => ({ type: "session" as const, id: "", title: "", status: "in_progress" as const });

export const stubEnvironment = (
  storage: CommandRunnerEnvironment["storage"],
  overrides: Partial<CommandRunnerEnvironment> = {},
): CommandRunnerEnvironment => {
  const queuedRequestsRequireHost = async () => {
    throw new Error("Queued requests require the host runtime.");
  };
  const environment: CommandRunnerEnvironment = {
    project: { id: "p1", name: "Prompt Studio", shorthand: "PS" },
    resources: createMemoryResources({}),
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
      query: async () => ({ items: [], nextCursor: null }),
      get: async () => null,
      create: async () => createSessionResource(),
      followup: async () => {},
      getQueuedFollowUps: queuedRequestsRequireHost,
      updateQueuedFollowUp: queuedRequestsRequireHost,
      combineQueuedFollowUps: queuedRequestsRequireHost,
      steerQueuedFollowUp: queuedRequestsRequireHost,
      addAnchors: async () => {},
      removeAnchors: async () => {},
    },
    workspaces: {
      addAnchors: async () => {},
      removeAnchors: async () => {},
      listProviders: async () => [],
      getDefault: async () => null,
      list: async () => [],
      get: async () => null,
      getByShorthand: async () => null,
      create: async () => ({ id: "" }),
      resolve: async () => ({}) as never,
      cancel: async () => ({ id: "" }),
      removeWorktree: async () => ({ removed: true }),
      delete: async () => {},
    },
    activity: { record: async () => ({ id: "" }) },
    notify: {
      toast: async () => {},
      action: async () => ({}) as never,
      resolve: async () => [],
      dismiss: async () => [],
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
    ...overrides,
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
