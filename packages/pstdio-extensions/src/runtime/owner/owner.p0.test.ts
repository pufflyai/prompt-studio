import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStorageId, createStorageMigration, createStoragePositions } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionOwner } from "./supervisor";

const owners: Array<ReturnType<typeof createExtensionOwner>> = [];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(owners.splice(0).map((owner) => owner.dispose()));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const extension = (body: string) => {
  const path = mkdtempSync(join(tmpdir(), "extension-owner-"));
  roots.push(path);
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, "package.json"),
    JSON.stringify({
      name: "owner",
      publisher: "test",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(path, "extension.ts"), body);
  const owner = createExtensionOwner({ path });
  owners.push(owner);
  return owner;
};

test("imports and executes synchronous extension work outside the host event loop", async () => {
  const owner = extension(`const end = Date.now() + 100; while (Date.now() < end) {};
    export default { commands: [{ id: 'work', ref: { kind: 'command', id: 'work' }, title: 'Work', run: async (ctx) => {
      const end = Date.now() + 100; while (Date.now() < end) {};
      await ctx.storage.set('value', ctx.projectId); return { pid: process.pid, secret: process.env.OWNER_TEST_SECRET };
    } }] };`);
  process.env.OWNER_TEST_SECRET = "host-secret";
  let beats = 0;
  const timer = setInterval(() => beats++, 5);
  try {
    const source = await owner.load();
    const writes: unknown[] = [];
    const result = await source!.definition.commands![0]!.run(
      {
        projectId: "project",
        storage: {
          set: async (...args: unknown[]) => {
            writes.push(args);
          },
        },
      } as never,
      {},
    );
    expect(result).toEqual({ pid: owner.pid, secret: undefined });
    expect(writes).toEqual([["value", "project"]]);
    expect(beats).toBeGreaterThan(5);
  } finally {
    clearInterval(timer);
    delete process.env.OWNER_TEST_SECRET;
  }
});

test("Stop cancels import loops, stays stopped on reads, and explicit Restart permits recovery", async () => {
  const owner = extension("while (true) {}; export default {};");
  const loading = owner.load();
  const failure = loading.catch((error) => error);
  await Bun.sleep(40);
  await owner.stop();
  expect(await failure).toMatchObject({ code: "extension_owner_stopped" });
  await expect(owner.load()).rejects.toMatchObject({ code: "extension_owner_stopped" });
  writeFileSync(join(owner.sourcePath, "extension.ts"), "export default {};");
  await owner.restart();
  expect((await owner.load())?.manifest.id).toBe("test.owner");
});

test("shares module state, preserves scopes and binary values, and settles an owner killed during a call", async () => {
  const owner =
    extension(`let count = 0; export default { commands: [{ id: 'run', ref: { kind: 'command', id: 'run' }, title: 'Run', run: async (ctx, input) => {
    if (input.loop) while (true) {};
    const bytes = await ctx.packageFiles.readBytes('file'); return { project: ctx.projectId, bytes, count: ++count };
  } }] };`);
  const source = await owner.load();
  const run = source!.definition.commands![0]!.run;
  const ctx = (projectId: string) => ({ projectId, packageFiles: { readBytes: async () => new Uint8Array([1, 2]) } });
  expect(await run(ctx("a") as never, {})).toEqual({ project: "a", bytes: new Uint8Array([1, 2]), count: 1 });
  expect(await run(ctx("b") as never, {})).toEqual({ project: "b", bytes: new Uint8Array([1, 2]), count: 2 });
  const controller = new AbortController();
  const hung = run({ ...ctx("a"), signal: controller.signal } as never, { loop: true });
  const failed = Promise.resolve(hung).catch((error) => error);
  await Bun.sleep(20);
  controller.abort();
  expect(await failed).toMatchObject({ code: "extension_owner_cancelled" });
});

test("preserves synchronous context factories, streams and extension error codes", async () => {
  const owner =
    extension(`export default { commands: [{ id: 'run', ref: { kind: 'command', id: 'run' }, title: 'Run', run: async (ctx, input) => {
    if (input.fail) throw Object.assign(new Error('source failed'), { code: 'source_failure' });
    const value = await ctx.storage.scope({ type: 'resource', resource: { id: 'r' } }).collection('items').get('item');
    const chunks = []; for await (const part of ctx.connections.stream('connection', {})) chunks.push(part);
    return { value, chunks };
  } }] };`);
  const source = await owner.load();
  const ctx = {
    storage: { scope: () => ({ collection: () => ({ get: async (id: string) => id }) }) },
    connections: {
      stream: async function* () {
        yield "one";
        yield "two";
      },
    },
  };
  const run = source!.definition.commands![0]!.run;
  expect(await run(ctx as never, {})).toEqual({ value: "item", chunks: ["one", "two"] });
  await expect(Promise.resolve(run(ctx as never, { fail: true }))).rejects.toMatchObject({
    code: "source_failure",
    message: "source failed",
  });
});

test("an explicit command after cancellation restores its adopted bytes without replaying the failed call", async () => {
  const owner =
    extension(`export default { commands: [{ id: 'run', ref: { kind: 'command', id: 'run' }, title: 'Run', run: (ctx, input) => {
    if (input.loop) while (true) {}; return 'adopted';
  } }] };`);
  const source = await owner.load();
  const run = source!.definition.commands![0]!.run;
  const controller = new AbortController();
  const failed = Promise.resolve(run({ signal: controller.signal } as never, { loop: true })).catch((error) => error);
  await Bun.sleep(20);
  controller.abort();
  expect(await failed).toMatchObject({ code: "extension_owner_cancelled" });
  writeFileSync(join(owner.sourcePath, "extension.ts"), "throw new Error('unadopted edit');");
  expect(await run({} as never, {})).toBe("adopted");
});

test("rejects unsupported command payloads explicitly", async () => {
  const owner = extension(
    `export default { commands: [{ id: 'run', ref: { kind: 'command', id: 'run' }, title: 'Run', run: () => new Map([['x', 1]]) }] };`,
  );
  const source = await owner.load();
  await expect(Promise.resolve(source!.definition.commands![0]!.run({} as never, {}))).rejects.toThrow(
    "Unsupported extension payload prototype",
  );
});

test("keeps synchronous IDs, migration helpers, positions, URLs and middleware results synchronous", async () => {
  const owner =
    extension(`export default { commands: [{ id: 'run', ref: { kind: 'command', id: 'run' }, title: 'Run', run: async (ctx) => {
    const id = ctx.storage.ids.create('item');
    const position = ctx.storage.positions.between();
    let imported;
    await ctx.storage.migrate(1, async (_previous, migration) => { imported = migration.id('original', 'item'); });
    return { id, position, imported, url: ctx.storage.files.urlFor('a b'), middleware: ctx.commands.patchParams({ x: 1 }) };
  } }] };`);
  const source = await owner.load();
  const migration = createStorageMigration(["extension", "project", 1]);
  const value = (await source!.definition.commands![0]!.run(
    {
      storage: {
        ids: { create: createStorageId },
        positions: createStoragePositions("test-device"),
        migrate: async (_version: number, run: (version: number, helper: typeof migration) => Promise<void>) =>
          run(0, migration),
        files: { urlFor: (id: string) => `/files/${encodeURIComponent(id)}` },
      },
      commands: { patchParams: (params: unknown) => ({ type: "patchParams", params }) },
    } as never,
    {},
  )) as { id: unknown; position: unknown; imported: unknown; url: unknown; middleware: unknown };
  expect(typeof value.id).toBe("string");
  expect(typeof value.position).toBe("string");
  expect(value.imported).toBe(migration.id("original", "item"));
  expect(value.url).toBe("/files/a%20b");
  expect(value.middleware).toEqual({ type: "patchParams", params: { x: 1 } });
});
