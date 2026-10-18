import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let server: ReturnType<typeof Bun.serve>;
let client: ReturnType<typeof createClient>;
let root: string;
let projectId: string;
let subscriptions = 0;
const commandId = "test.outcomes.command.run";
const startServer = () => {
  server = Bun.serve({
    port: 0,
    fetch: (request) => {
      if (request.method === "POST" && new URL(request.url).pathname.endsWith("/subscriptions")) subscriptions++;
      return handle.app.fetch(request);
    },
  });
  client = createClient({ baseUrl: server.url.toString() });
};
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "command-outcomes-"));
  handle = await createTestApp();
  const project = await handle.deps.projectService.create({ name: "Command outcomes" });
  projectId = project.id;
  const manifest = {
    name: "outcomes",
    publisher: "test",
    version: "1.0.0",
    main: "extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  };
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(root, "extension.ts"),
    `export default {
    commands: [
      { id:"run",ref:{kind:"command",id:"run"},title:"Run",stream:{kind:"stream"},
        async run(ctx,params) {
          const runs=await ctx.storage.get("runs") ?? 0;
          await ctx.storage.set("runs",runs+1);
          await ctx.stream.write("first");
          if(params?.wait) await new Promise(resolve=>ctx.signal.addEventListener("abort",resolve,{once:true}));
          return "done";
        } },
      { id:"count",ref:{kind:"command",id:"count"},title:"Count",run:ctx=>ctx.storage.get("runs") }
    ],
    middlewares:[{id:"guard",ref:{kind:"middleware",id:"guard"},command:{kind:"command",id:"run"},
      run(ctx,params) { if(params?.reject) return ctx.commands.reject({
        code:"stale_revision",reason:"Changed",data:{revision:2},cause:{source:"storage"},
        notices:[{type:"warning",message:"Reload"}],
        diagnostics:[{code:"conflict",message:"Changed",severity:"warning"}]
      }); }
    }]
  };`,
  );
  await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    sourcePath: root,
    sourceKind: "local_path",
    name: "outcomes",
    installName: "outcomes",
    extensionId: "test.outcomes",
    displayName: "Outcomes",
    manifest,
  });
  startServer();
});
afterAll(async () => {
  server?.stop(true);
  await handle?.close();
  await rm(root, { recursive: true, force: true });
});

test("SDK command streams preserve rejected completion and match ordinary execution", async () => {
  const stream = client.extensions.streamCommand(projectId, commandId, { params: { reject: true } });
  expect(await Array.fromAsync(stream)).toEqual([]);
  const outcome = await stream.outcome;
  expect(outcome).toMatchObject({
    ok: false,
    status: "rejected",
    code: "stale_revision",
    data: { revision: 2 },
    cause: { source: "storage" },
    notices: [{ type: "warning" }],
    diagnostics: [{ code: "conflict" }],
  });
  expect((await client.extensions.execute(commandId, { projectId, params: { reject: true } })).outcome).toEqual(
    outcome,
  );
});

test("SDK command streams cancel before start and on early return", async () => {
  const controller = new AbortController();
  controller.abort();
  const before = subscriptions;
  const cancelled = client.extensions.streamCommand(projectId, commandId, {}, { signal: controller.signal });
  expect(await cancelled.outcome).toMatchObject({ code: "command_stream_cancelled" });
  expect(subscriptions).toBe(before);
  const stream = client.extensions.streamCommand(projectId, commandId, { params: { wait: true } });
  for await (const chunk of stream) {
    expect(chunk).toBe("first");
    break;
  }
  expect(await stream.outcome).toMatchObject({ code: "command_stream_cancelled" });
  expect(subscriptions).toBe(before + 1);
});

test("disconnecting an SDK command stream never runs the command again", async () => {
  const before = subscriptions;
  const stream = client.extensions.streamCommand(projectId, commandId, { params: { wait: true } });
  const iterator = stream[Symbol.asyncIterator]();
  expect((await iterator.next()).value).toBe("first");
  server.stop(true);
  expect(await stream.outcome).toMatchObject({ code: "command_stream_disconnected" });
  expect(await iterator.next()).toEqual({ done: true, value: undefined });
  startServer();
  expect(subscriptions).toBe(before + 1);
  const count = await client.extensions.execute("test.outcomes.command.count", { projectId });
  expect(count.outcome).toMatchObject({ ok: true, value: 2 });
});

test("the legacy event adapter retains a disconnect cause for webview hosts", async () => {
  const events = client.extensions.stream(commandId, { projectId, params: { wait: true } });
  const iterator = events[Symbol.asyncIterator]();
  expect((await iterator.next()).value).toEqual({ type: "data", data: "first" });
  server.stop(true);
  try {
    await expect(iterator.next()).rejects.toMatchObject({
      code: "command_stream_disconnected",
      cause: expect.any(Error),
    });
  } finally {
    startServer();
  }
});
