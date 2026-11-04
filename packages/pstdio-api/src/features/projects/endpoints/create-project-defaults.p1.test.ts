import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { writeExtension } from "../../extensions/default-extensions-test-fixtures";

test("new projects attach known tools without refreshing unselected extension code", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-known-extensions-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const source = join(root, "home/extensions/optional-tool");
  writeExtension(source, "optional-tool");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  const create = async (name: string) => {
    const path = join(root, name);
    await mkdir(path);
    return handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path } } }),
    });
  };
  let creating: Promise<Response> | undefined;
  try {
    expect((await create("first")).status).toBe(201);
    await writeFile(join(source, "extension.ts"), `await fetch(${JSON.stringify(gate.url.href)}); export default {};`);
    creating = create("second");
    expect(await Promise.race([creating.then(() => "created"), entered.promise.then(() => "unselected")])).toBe(
      "created",
    );
    const response = await creating;
    expect(response.status).toBe(201);
    const project = await response.json();
    const instances = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(
      instances.find(({ installedSource }) => installedSource.install_name === "optional-tool")?.instance.enabled,
    ).toBe(false);
  } finally {
    release.resolve();
    await creating;
    await handle.close();
    gate.stop(true);
    await rm(root, { recursive: true, force: true });
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
  }
});

test("concurrent projects open with complete defaults after a held installation", async () => {
  const root = await mkdtemp(join(tmpdir(), "concurrent-project-defaults-"));
  const previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const handle = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const requests: Promise<Response>[] = [];
  try {
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "shared-defaults",
        publisher: "example",
        version: "1.0.0",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(source, "extension.ts"),
      `await fetch(${JSON.stringify(gate.url.href)}); export default {views:[{
        id:"ready",ref:{kind:"view",id:"ready"},title:"Ready",
        body:{kind:"controls",query:()=>({params:[]})}
      }]};`,
    );
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source, installName: "shared-defaults", skipInstall: true },
    ]);
    const open = async (name: string) => {
      const path = join(root, name);
      await mkdir(path);
      return handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path } } }),
      });
    };
    requests.push(open("first"));
    await entered.promise;
    requests.push(open("second"));
    while (
      handle.deps.extensionInstallations.list().filter((job) => job.installName === "shared-defaults").length < 2
    ) {
      await Bun.sleep(1);
    }
    const listed = await handle.app.request("/v1/projects");
    expect(await listed.json()).toHaveLength(0);
    release.resolve();

    for (const response of await Promise.all(requests)) {
      expect(response.status).toBe(201);
      const project = await response.json();
      expect(project.extension_warnings ?? []).toEqual([]);
      const metadata = await handle.app.request(`/v1/projects/${project.id}/extensions/ui`);
      expect((await metadata.json()).views).toContainEqual(
        expect.objectContaining({ extensionId: "example.shared-defaults", localId: "ready" }),
      );
    }
  } finally {
    release.resolve();
    await Promise.allSettled(requests);
    gate.stop(true);
    await handle.close();
    await rm(root, { recursive: true, force: true });
    if (previous.home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous.home;
    if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
  }
});
