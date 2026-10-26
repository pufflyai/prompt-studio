import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createResourceCoordinator } from "../resource-coordinator";
import { createExtensionOwner } from "./supervisor";

const writeSource = (path: string, body: string) => {
  writeFileSync(
    join(path, "package.json"),
    JSON.stringify({
      name: "admission",
      version: "1.0.0",
      publisher: "test",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(path, "extension.ts"), body);
};

test("cancelling queued dispatch does not interrupt accepted calls in the same owner", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-owner-queued-cancel-"));
  writeSource(
    root,
    `export default { commands: [{ id: 'work', run: () => {
    const end = Date.now() + 150; while (Date.now() < end) {} return 'accepted';
  } }] };`,
  );
  const resources = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 256 }) });
  const owner = createExtensionOwner({ path: root, resources });
  try {
    const source = await owner.load();
    const run = source!.definition.commands![0]!.run;
    const first = Promise.resolve(run({} as never, {}));
    await Bun.sleep(10);
    const pid = owner.pid;
    const controller = new AbortController();
    const cancelled = Promise.resolve(run({ signal: controller.signal } as never, {})).catch((error) => error);
    controller.abort();
    expect(await cancelled).toBeInstanceOf(Error);
    expect(await first).toBe("accepted");
    expect(owner.pid).toBe(pid);
    expect(resources.snapshot().queued).toBe(0);
  } finally {
    await owner.dispose();
    resources.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stop removes queued initialization before a source process is spawned", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-owner-admission-"));
  const resources = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 0 }) });
  const owner = createExtensionOwner({ path: root, resources });
  try {
    const loading = owner.load();
    const failure = loading.catch((error) => error);
    await Bun.sleep(0);
    expect(resources.snapshot().queued).toBe(1);
    expect(owner.pid).toBeUndefined();
    await owner.stop();
    expect((await failure).code).toBe("extension_owner_stopped");
    expect(resources.snapshot().queued).toBe(0);
    expect(owner.pid).toBeUndefined();
  } finally {
    await owner.dispose();
    resources.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a real owner releases CPU for host storage and nested owners at one-job capacity", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-owner-nested-admission-"));
  const nestedRoot = mkdtempSync(join(tmpdir(), "pstdio-child-admission-"));
  writeSource(
    nestedRoot,
    `export default { commands: [{ id: 'nested', run: () => ({ pid: process.pid, value: 'nested result' }) }] };`,
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "nested",
      version: "1.0.0",
      publisher: "test",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default { commands: [{ id: 'nested', run: async (ctx) => {
    const value = await ctx.storage.get('value');
    const scoped = await ctx.storage.scope({ type: 'project' }).get('value');
    return ctx.commands.execute(value === scoped ? value : 'wrong scope');
  } }] };`,
  );
  const resources = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 256 }) });
  const owner = createExtensionOwner({ path: root, resources });
  const nested = createExtensionOwner({ path: nestedRoot, resources });
  try {
    const source = await owner.load();
    const run = source!.definition.commands![0]!.run!;
    const result = await (run as (context: unknown) => Promise<unknown>)({
      storage: {
        scope: () => ({
          get: async () => {
            expect(resources.snapshot().running).toEqual({ cpu: 0, memory: 16 });
            return "nested";
          },
        }),
        get: async () => {
          expect(resources.snapshot().running).toEqual({ cpu: 0, memory: 16 });
          return "nested";
        },
      },
      commands: {
        execute: async (value: string) => {
          expect(value).toBe("nested");
          const child = await nested.load();
          return child!.definition.commands![0]!.run({} as never, {});
        },
      },
    });
    expect(result).toEqual({ pid: nested.pid, value: "nested result" });
    expect(nested.pid).not.toBe(owner.pid);
    expect(resources.snapshot().running).toEqual({ cpu: 0, memory: 0 });
  } finally {
    await owner.dispose();
    await nested.dispose();
    resources.dispose();
    rmSync(root, { recursive: true, force: true });
    rmSync(nestedRoot, { recursive: true, force: true });
  }
});
