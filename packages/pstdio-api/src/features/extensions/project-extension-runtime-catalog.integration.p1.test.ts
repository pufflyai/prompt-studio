import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionPackage, readAcceptedRevision } from "pstdio-extensions";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import type { AppBindings } from "../../types";

let app: OpenAPIHono<AppBindings>;
let handle: Awaited<ReturnType<typeof createTestApp>>;
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
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      commands: [
        {
          id: "ping",
          ref: { kind: "command", id: "ping" },
          title: ${JSON.stringify(commandTitle)},
          async run() {
            return { ok: true };
          },
        },
      ],
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
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });
  app = handle.app;

  const project = await createJson("/v1/projects", folderProjectInput({ name: "Catalog Project" }));
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
  test("declared indexes are installed locally before a replacement runtime publishes", async () => {
    const storage = await handle.deps.extensionStorageService.open({
      owner: { workbenchId: projectId, extensionId: "pstdio.lab" },
    });
    await storage.records.commit({
      operationId: "before-index-install",
      edits: [{ recordId: "selected", replace: { title: "Saved before local index installation" } }],
    });
    // A migration received from another device must not skip local index installation.
    await storage.setDataVersion(JSON.stringify(["project", projectId]), 2);
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default {
      storageIndexes: [{ name: "titles", fields: { title: { path: ["title"], type: "string" } } }],
      commands: [{ id: "query", ref: { kind: "command", id: "query" }, title: "Query titles",
        async run(ctx) { return ctx.storage.records.query({ index: "titles", fields: ["title"] }); }
      }],
    };`,
    );
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    const response = await app.request(
      `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.query/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: {} }),
      },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).outcome).toMatchObject({
      ok: true,
      value: {
        records: [{ recordId: "selected", fields: { title: "Saved before local index installation" } }],
        cursor: null,
      },
    });
  });

  test("unchanged command and metadata volume reuses one snapshot generation", async () => {
    const warm = await handle.deps.extensionRuntimeCatalog.get(projectId);

    for (let call = 0; call < 2; call += 1) {
      const execute = await app.request(
        `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.ping/execute`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ params: {} }),
        },
      );
      expect(execute.status).toBe(200);
    }
    expect((await app.request(`/v1/projects/${projectId}/extensions/commands`)).status).toBe(200);
    expect((await app.request(`/v1/projects/${projectId}/extensions/appearance`)).status).toBe(200);
    expect((await app.request(`/v1/projects/${projectId}/extensions/ui`)).status).toBe(200);

    // Same object identity: every consumer above read this one published snapshot.
    const after = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(after).toBe(warm);
  });

  test("a source reload publishes the new handlers and then reuses one snapshot", async () => {
    const before = await handle.deps.extensionRuntimeCatalog.get(projectId);

    writeExtension(tempRoot, "Ping v2");
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);

    // A consumer may read between the source change and its webview build. That read publishes,
    // and the build makes the next read refresh the bundle URLs once.
    const after = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(after.generation).toBeGreaterThan(before.generation);
    expect(after.generation).toBeLessThanOrEqual(before.generation + 2);
    expect(await handle.deps.extensionRuntimeCatalog.get(projectId)).toBe(after);

    const commands = (await (await app.request(`/v1/projects/${projectId}/extensions/commands`)).json()) as {
      commands: Array<{ id: string; title: string }>;
    };
    expect(commands.commands).toContainEqual(
      expect.objectContaining({ id: "pstdio.lab.command.ping", title: "Ping v2" }),
    );
  });

  test("reloading unchanged source runs the next call with fresh module state", async () => {
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `let calls = 0;
      export default {
        commands: [{ id: "count", ref: { kind: "command", id: "count" }, title: "Count", run: () => ++calls }],
      };`,
    );
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    const count = async () => {
      const response = await app.request(
        `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.count/execute`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ params: {} }) },
      );
      expect(response.status).toBe(200);
      return (await response.json()).outcome.value as number;
    };
    expect(await count()).toBe(1);
    expect(await count()).toBe(2);

    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    expect(await count()).toBe(1);
  });

  test("reloading one changed folder leaves the shared worker available to another folder", async () => {
    const body = `let calls = 0;
      export default { commands: [{ id: "ping", ref: { kind: "command", id: "ping" }, title: "Ping",
        run: () => ++calls }] };`;
    writeFileSync(join(sourcePath, "extension.ts"), body);
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    const commandPath = `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.ping/execute`;
    expect((await createJson(commandPath, { params: {} })).outcome.value).toBe(1);

    const other = writeExtension(join(tempRoot, "other"), "Ping");
    writeFileSync(join(other, "extension.ts"), body);
    const diagnostics: Parameters<typeof loadExtensionPackage>[1] = [];
    const loaded = await loadExtensionPackage({ path: other }, diagnostics);
    expect(diagnostics).toEqual([]);
    expect(loaded!.preparedRevision!.id).toBe((await readAcceptedRevision(sourcePath))!.id);
    const [{ run }] = loaded!.definition.commands!;
    expect(await run({} as never, {})).toBe(2);

    writeExtension(tempRoot, "Ping v2");
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    expect((await createJson(commandPath, { params: {} })).outcome.value).toEqual({ ok: true });
    expect(await run({} as never, {})).toBe(3);
  });

  test("reload replaces the cached runtime wrappers after a definition mismatch", async () => {
    const titlePath = join(tempRoot, "title.txt");
    writeFileSync(titlePath, "Before");
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `import { readFileSync } from "node:fs";
        const title = readFileSync(${JSON.stringify(titlePath)}, "utf8");
        export default { commands: [{ id: "ping", ref: { kind: "command", id: "ping" }, title,
          run: () => title }] };`,
    );
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    const before = (await readAcceptedRevision(sourcePath))!.id;
    await handle.deps.extensionRuntimeCatalog.get(projectId);
    writeFileSync(titlePath, "After");

    const commandPath = `/v1/projects/${projectId}/extensions/commands/pstdio.lab.command.ping/execute`;
    expect((await createJson(commandPath, { params: {} })).outcome.reason).toContain("different definition");

    const reload = await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
    expect(reload.installedSource.status).toBe("loaded");
    expect((await readAcceptedRevision(sourcePath))!.id).toBe(before);
    expect((await createJson(commandPath, { params: {} })).outcome).toMatchObject({ ok: true, value: "After" });
  });

  test("toggling extension enablement invalidates only that project's snapshot", async () => {
    const records = await handle.deps.extensionService.listProjectExtensionInstances(projectId);
    const labInstance = records.find((record) => record.installedSource.extension_id === "pstdio.lab");
    expect(labInstance).toBeDefined();

    const before = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(before.runtime.commands.map((command) => command.id)).toContain("pstdio.lab.command.ping");

    await handle.deps.extensionService.setProjectExtensionEnabled(labInstance!.instance.id, false);
    const disabled = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(disabled).not.toBe(before);
    expect(disabled.runtime.commands).toHaveLength(0);

    await handle.deps.extensionService.setProjectExtensionEnabled(labInstance!.instance.id, true);
    const enabled = await handle.deps.extensionRuntimeCatalog.get(projectId);
    expect(enabled.runtime.commands.map((command) => command.id)).toContain("pstdio.lab.command.ping");
  });
});
