import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";

let app: OpenAPIHono<AppBindings>;
let handle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let sourcePath: string;
let projectId: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const writeExtension = (root: string, commandTitle: string) => {
  const extensionRoot = join(root, "extensions", "lab");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Extension Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      commands: {
        ping: {
          title: ${JSON.stringify(commandTitle)},
          async run() {
            return { ok: true };
          },
        },
      },
    };`,
  );
  return extensionRoot;
};

const createJson = async (path: string, body: unknown) => {
  const response = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
};

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-runtime-catalog-integration-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = handle.app;

  const project = await createJson("/v1/projects", { name: "Catalog Project" });
  projectId = project.id;
  sourcePath = writeExtension(tempRoot, "Ping");

  const enableResponse = await app.request(`/v1/projects/${projectId}/extensions/installed/lab/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Extension Lab",
      extensionId: "pstdio.lab",
      manifest: { id: "pstdio.lab", name: "lab" },
      name: "lab",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    }),
  });
  expect(enableResponse.status).toBe(200);
});

afterEach(async () => {
  await handle.close();
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("project extension runtime snapshot integration", () => {
  test("unchanged command and metadata volume reuses one snapshot generation", async () => {
    const warm = await handle.deps.extensionRuntimeCatalog.get(projectId);

    for (let call = 0; call < 2; call += 1) {
      const execute = await app.request(`/v1/projects/${projectId}/extensions/commands/lab.ping/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: {} }),
      });
      expect(execute.status).toBe(200);
    }
    expect((await app.request(`/v1/projects/${projectId}/extensions/commands`)).status).toBe(200);
    expect((await app.request(`/v1/projects/${projectId}/extensions/appearance`)).status).toBe(200);
    expect((await app.request(`/v1/projects/${projectId}/extensions/ui`)).status).toBe(200);

    // Same object identity: every consumer above read this one published snapshot.
    const after = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(after).toBe(warm);
  });

  test("a source reload publishes exactly one new generation with the new handlers", async () => {
    const before = await handle.deps.extensionRuntimeCatalog.get(projectId);

    writeExtension(tempRoot, "Ping v2");
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);

    const after = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(after.generation).toBe(before.generation + 1);
    expect(await handle.deps.extensionRuntimeCatalog.get(projectId)).toBe(after);

    const commands = (await (await app.request(`/v1/projects/${projectId}/extensions/commands`)).json()) as {
      commands: Array<{ id: string; title: string }>;
    };
    expect(commands.commands).toContainEqual(expect.objectContaining({ id: "lab.ping", title: "Ping v2" }));
  });

  test("toggling extension enablement invalidates only that project's snapshot", async () => {
    const records = await handle.deps.extensionService.listProjectExtensionInstances(projectId);
    const labInstance = records.find((record) => record.installedSource.extension_id === "pstdio.lab");
    expect(labInstance).toBeDefined();

    const before = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(before.runtime.commands.map((command) => command.id)).toContain("lab.ping");

    await handle.deps.extensionService.setProjectExtensionEnabled(labInstance!.instance.id, false);
    const disabled = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(disabled).not.toBe(before);
    expect(disabled.runtime.commands).toHaveLength(0);

    await handle.deps.extensionService.setProjectExtensionEnabled(labInstance!.instance.id, true);
    const enabled = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(enabled.runtime.commands.map((command) => command.id)).toContain("lab.ping");
  });
});
