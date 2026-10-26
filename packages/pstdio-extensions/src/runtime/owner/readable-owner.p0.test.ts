import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionOwner } from "./supervisor";

test("real owner readers keep context through cancellation and byte-stream CPU loops", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-owner-readable-"));
  const owner = createExtensionOwner({ path: root });
  const controller = new AbortController();
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "readable",
        publisher: "test",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(root, "extension.ts"),
      `export default { commands: [{
      id: 'read', run: (ctx, input) => {
        let first = true;
        return new ReadableStream({
          ...(input.bytes ? { type: 'bytes' } : {}),
          async pull(controller) {
            if (first) { first = false; controller.enqueue(new Uint8Array([Number(ctx.signal.aborted)])); return; }
            await ctx.storage.set('started', ctx.projectId);
            while (true) {};
          },
          cancel: (reason) => ctx.storage.set('cancelled', { code: reason.code, project: ctx.projectId, aborted: ctx.signal.aborted }),
        }, { highWaterMark: 0 });
      }
    }] };`,
    );
    const source = await owner.load();
    const run = source!.definition.commands![0]!.run;
    const writes: unknown[] = [];
    const stream = (await run(
      {
        projectId: "first",
        signal: new AbortController().signal,
        storage: {
          set: async (...args: unknown[]) => {
            writes.push(args);
          },
        },
      } as never,
      {},
    )) as unknown as ReadableStream<Uint8Array>;
    const reader = stream.getReader();
    expect((await reader.read()).value).toEqual(new Uint8Array([0]));
    await reader.cancel(Object.assign(new Error("finished"), { code: "consumer_closed" }));
    expect(writes).toEqual([["cancelled", { code: "consumer_closed", project: "first", aborted: false }]]);
    reader.releaseLock();

    const started = Promise.withResolvers<void>();
    const looping = (await run(
      {
        projectId: "second",
        signal: controller.signal,
        storage: {
          set: async (key: string, project: string) => {
            expect([key, project]).toEqual(["started", "second"]);
            started.resolve();
          },
        },
      } as never,
      { bytes: true },
    )) as unknown as ReadableStream<Uint8Array>;
    const bytes = looping.getReader({ mode: "byob" });
    expect((await bytes.read(new Uint8Array(16))).value).toEqual(new Uint8Array([0]));
    const pending = bytes.read(new Uint8Array(16)).catch((error) => error);
    await started.promise;
    controller.abort();
    expect(await pending).toMatchObject({ code: "extension_owner_cancelled" });
    expect(owner.inspect().pendingCalls).toBe(0);
    bytes.releaseLock();
  } finally {
    controller.abort();
    await owner.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
