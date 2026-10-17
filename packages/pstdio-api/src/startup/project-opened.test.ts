import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../test-utils/create-test-app";

test("startup discovers repository hooks before opening projects and awaits them during shutdown", async () => {
  const root = await mkdtemp(join(tmpdir(), "startup-project-opened-"));
  const previousHome = process.env.PSTDIO_HOME;
  const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const options = { databasePath: join(root, "database"), storageRoot: join(root, "storage") };
  const activation = Promise.withResolvers<string>();
  const release = Promise.withResolvers<void>();
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    const folder = join(root, "project");
    await mkdir(folder);
    handle = await createTestApp(options);
    const response = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path: folder } } }),
    });
    expect(response.status).toBe(201);
    await handle.close();
    handle = undefined;
    const source = join(folder, ".pstdio/extensions/startup-hook");
    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "startup-hook",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(source, "extension.ts"),
      `export default { hooks: [{ id: "opened", ref: { kind: "hook", id: "opened" }, event: { extensionId: "pstdio", kind: "event", id: "project.opened" }, async run(ctx) { await ctx.projectFiles.writeText("opened.txt", "opened"); } }] };`,
    );
    handle = await createTestApp(options);
    handle.deps.extensionRuntimeCatalog.subscribeActivation((projectId) => {
      activation.resolve(projectId);
      return release.promise;
    });
    const projectId = await activation.promise;
    const snapshot = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(snapshot.runtime.hooks).toHaveLength(1);
    await Bun.sleep(0);
    let closed = false;
    const closing = handle.close().then(() => {
      closed = true;
    });
    await Bun.sleep(0);
    expect(closed).toBe(false);
    release.resolve();
    await closing;
    handle = undefined;
    expect(await readFile(join(folder, "opened.txt"), "utf8")).toBe("opened");
  } finally {
    release.resolve();
    await handle?.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
    await rm(root, { recursive: true, force: true });
  }
});
