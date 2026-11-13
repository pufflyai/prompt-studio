import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionPackage } from "./loader";
import {
  configureExtensionPreparationWorker,
  runExtensionPreparation,
  stopExtensionPreparation,
} from "./preparation-client";

test("temporary preparation admission failure rejects a load and the unchanged source can recover", async () => {
  const root = await mkdtemp(join(tmpdir(), "loader-preparation-recovery-"));
  const source = join(root, "extension");
  await mkdir(source);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  configureExtensionPreparationWorker(() => new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url)));
  const held = runExtensionPreparation("wait", { name: "active", url: server.url.href });
  const queued: Promise<unknown>[] = [];
  try {
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "recovery",
        publisher: "test",
        version: "1.0.0",
        type: "module",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(join(source, "extension.ts"), "export default { commands: [] };");
    await entered.promise;
    for (let index = 0; index < 128; index++)
      queued.push(runExtensionPreparation("value", { name: String(index) }).catch((error) => error));
    await expect(loadExtensionPackage({ path: source }, [])).rejects.toThrow("queue is full");
    release.resolve();
    await Promise.all([held, ...queued]);
    configureExtensionPreparationWorker(() => new Worker(new URL("./preparation-worker.ts", import.meta.url)));
    const diagnostics: Parameters<typeof loadExtensionPackage>[1] = [];
    const loaded = await loadExtensionPackage({ path: source }, diagnostics);
    expect(diagnostics).toEqual([]);
    expect(loaded?.definition).toEqual({ commands: [] });
  } finally {
    release.resolve();
    await Promise.allSettled([held, ...queued]);
    await stopExtensionPreparation();
    configureExtensionPreparationWorker(() => new Worker(new URL("./preparation-worker.ts", import.meta.url)));
    await server.stop(true);
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
