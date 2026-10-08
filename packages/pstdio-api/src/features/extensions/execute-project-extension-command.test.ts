import { afterEach, beforeEach, expect, test } from "bun:test";
import { executeProjectExtensionCommand } from "./execute-project-extension-command";
import { createWorkspaceContextFixture } from "./workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});

const execute = (body = {}) =>
  executeProjectExtensionCommand(fixture.deps, {
    projectId: "project-1",
    commandId: "example.context.command.inspect",
    body,
  });

test("an omitted workspace uses the trusted default workspace in the command context", async () => {
  const result = await execute();
  expect(result.outcome).toMatchObject({
    status: "success",
    value: {
      workspaceId: fixture.workspace.id,
      repoPath: null,
      text: "selected folder",
    },
  });
});

test("a remote default never mounts a local path", async () => {
  Object.assign(fixture.workspace, { execution_kind: "remote", root_path: fixture.root });
  expect((await execute()).outcome).toMatchObject({
    status: "success",
    value: {
      workspaceId: fixture.workspace.id,
      repoPath: null,
      text: null,
    },
  });
});

test("cancelling a workspace lookup prevents command execution", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const controller = new AbortController();
  const deps = {
    ...fixture.deps,
    workspaceService: {
      ...fixture.deps.workspaceService,
      getDefault: async () => {
        entered.resolve();
        await release.promise;
        return fixture.workspace;
      },
    },
  };
  const executing = executeProjectExtensionCommand(deps, {
    projectId: "project-1",
    commandId: "example.context.command.inspect",
    body: {},
    signal: controller.signal,
  });
  await entered.promise;
  controller.abort();
  release.resolve();
  await executing.catch(() => undefined);
  await expect(executing).rejects.toMatchObject({ name: "AbortError" });
});

test("streamed commands deliver chunks and still return the final outcome", async () => {
  const snapshot = await fixture.deps.extensionRuntimeCatalog.get("project-1");
  const command = snapshot.runtime.commands[0]!;
  command.stream = { kind: "stream" };
  command.run = async (ctx) => {
    await ctx.stream.write({ line: 1 });
    await ctx.stream.write({ line: 2 });
    return 2;
  };
  const chunks: unknown[] = [];
  const response = await executeProjectExtensionCommand(fixture.deps, {
    projectId: "project-1",
    commandId: command.id,
    body: {},
    onChunk: async (chunk) => {
      chunks.push(chunk);
    },
  });
  expect(chunks).toEqual([{ line: 1 }, { line: 2 }]);
  expect(response.outcome).toMatchObject({ ok: true, value: 2 });
});

test("ordinary execution drops chunks from a streaming command", async () => {
  const snapshot = await fixture.deps.extensionRuntimeCatalog.get("project-1");
  const command = snapshot.runtime.commands[0]!;
  command.stream = { kind: "stream" };
  command.run = async (ctx) => {
    await ctx.stream.write({ line: 1 });
    return "done";
  };
  expect((await execute()).outcome).toMatchObject({ ok: true, value: "done" });
});
