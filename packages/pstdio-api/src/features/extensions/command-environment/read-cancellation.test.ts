import { expect, test } from "bun:test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts";
import { createCommandRunner, normalizeExtensionSources } from "pstdio-extensions";
import { createCommandEnvironment } from "./index";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

test("cancelled command readers do not dispatch host work", async () => {
  const controller = new AbortController();
  let reads = 0;
  const deps = {
    sessionService: {
      list: async () => {
        reads++;
        return [];
      },
    },
    workspaceService: {
      list: async () => {
        reads++;
        return [];
      },
      get: async (id: string) => {
        reads++;
        return { id, project_id: "p" };
      },
    },
    workspaceSessionService: {
      listByWorkspace: async () => {
        reads++;
        return [];
      },
    },
  } as never;
  const sessions = createSessionsApi(deps, { projectId: "p", project: {} as never, signal: controller.signal });
  const workspaces = createWorkspacesApi(deps, { projectId: "p", signal: controller.signal }, {} as never);
  controller.abort();
  const results = await Promise.allSettled([sessions.list(), sessions.listByWorkspace("w"), workspaces.list()]);
  expect(reads).toBe(0);
  expect(results.map((result) => result.status)).toEqual(["rejected", "rejected", "rejected"]);
});

test("cancellation during workspace resolution prevents the next session lookup", async () => {
  const controller = new AbortController();
  const workspace = Promise.withResolvers<{ id: string; project_id: string }>();
  let childReads = 0;
  const sessions = createSessionsApi(
    {
      workspaceService: { get: () => workspace.promise },
      workspaceSessionService: {
        listByWorkspace: async () => {
          childReads++;
          return [];
        },
      },
    } as never,
    { projectId: "p", project: {} as never, signal: controller.signal },
  );
  const reading = sessions.listByWorkspace("w");
  controller.abort();
  workspace.resolve({ id: "w", project_id: "p" });
  await expect(reading).rejects.toThrow();
  expect(childReads).toBe(0);
});

test("a cancelled real command invocation cannot continue into later host readers", async () => {
  const started = Promise.withResolvers<void>();
  const firstRead = Promise.withResolvers<[]>();
  const controller = new AbortController();
  let laterReads = 0;
  const deps = {
    workspaceService: {
      list: async () => {
        started.resolve();
        return firstRead.promise;
      },
    },
    sessionService: {
      list: async () => {
        laterReads++;
        return [];
      },
    },
    extensionStorageService: {
      getKv: async () => {
        laterReads++;
        return null;
      },
    },
  } as never;
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/tmp/read-boundary",
      sourcePath: "/tmp/read-boundary/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "test.read-boundary",
        publisher: "test",
        name: "read-boundary",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: EXTENSION_API_VERSION,
      },
      definition: {
        commands: [
          {
            id: "read",
            ref: { kind: "command", id: "read" },
            title: "Read",
            async run(ctx) {
              await ctx.workspaces.list();
              await ctx.sessions.list();
              await ctx.storage.get("key");
              return {};
            },
          },
        ],
      },
    },
  ]);
  const runner = createCommandRunner(runtime, {
    buildEnvironment: () =>
      createCommandEnvironment(
        deps,
        [
          {
            instance: { id: "instance" },
            installedSource: { id: "source", extension_id: "test.read-boundary", source_path: "/tmp/read-boundary" },
          },
        ] as never,
        {
          extensionId: "test.read-boundary",
          name: "read-boundary",
          projectId: "p",
          project: { id: "p", name: "Project", shorthand: "P" },
        },
      ),
  });
  const running = runner.execute({
    commandId: "test.read-boundary.command.read",
    projectId: "p",
    signal: controller.signal,
  });
  await started.promise;
  controller.abort();
  firstRead.resolve([]);
  expect((await running).ok).toBe(false);
  expect(laterReads).toBe(0);
});
