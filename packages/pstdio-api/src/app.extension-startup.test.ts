import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryConnectionSecretStore } from "./features/extensions/connection-secret-store";
import { createTestExtensionSource } from "./features/extensions/test-utils/create-test-extension-source";
import { createTestApp } from "./test-utils/create-test-app";

test("opens the app while extension connection cleanup is still pending", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const opening = createTestApp({
    connectionSecretStore: {
      ...createMemoryConnectionSecretStore(),
      listRefs: async () => {
        entered.resolve();
        await release.promise;
        return [];
      },
    },
  });
  try {
    await entered.promise;
    const handle = await Promise.race([opening, Bun.sleep(1_000).then(() => null)]);
    expect(handle).not.toBeNull();
    expect((await handle!.app.request("/v1/projects")).status).toBe(200);
    let closed = false;
    const closing = handle!.close().then(() => {
      closed = true;
    });
    await Bun.sleep(0);
    expect(closed).toBe(false);
    release.resolve();
    await closing;
  } finally {
    release.resolve();
    await (await opening).close();
  }
});

test("serves core requests while an extension imports and publishes it after loading", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-delayed-extension-"));
  process.env.PSTDIO_HOME = join(root, "home");
  const options = { databasePath: join(root, "db"), storageRoot: join(root, "storage") };
  const initial = await createTestApp(options);
  const project = await initial.deps.projectService.create({ name: "Slow extension" });
  await initial.close();

  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async () => {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const source = createTestExtensionSource({
    root: process.env.PSTDIO_HOME,
    installName: "slow-extension",
    name: "slow-extension",
    displayName: "Slow extension",
  });
  writeFileSync(join(source, "extension.ts"), `await fetch(${JSON.stringify(gate.url.href)});\nexport default {};\n`);
  const opening = createTestApp(options);
  try {
    await entered.promise;
    const handle = await Promise.race([opening, Bun.sleep(1_000).then(() => null)]);
    expect(handle).not.toBeNull();
    expect((await handle!.app.request("/v1/projects")).status).toBe(200);
    expect(await handle!.deps.extensionService.listProjectExtensionInstances(project.id)).toHaveLength(0);

    release.resolve();
    let instances = await handle!.deps.extensionService.listProjectExtensionInstances(project.id);
    for (let attempt = 0; instances.length === 0 && attempt < 100; attempt++) {
      await Bun.sleep(10);
      instances = await handle!.deps.extensionService.listProjectExtensionInstances(project.id);
    }
    expect(instances).toHaveLength(1);
    expect(instances[0]?.installedSource.status).toBe("loaded");
  } finally {
    release.resolve();
    await (await opening).close();
    await gate.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
});
