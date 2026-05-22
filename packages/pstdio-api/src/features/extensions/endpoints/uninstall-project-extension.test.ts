import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let tempRoot: string;
let counter = 0;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-uninstall-project-extension-test-"));
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: resolveTestFilesRoot(),
  });
  app = handle.app;
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return response.json();
};

const seedEnabledInstance = async (projectId: string) => {
  counter += 1;
  const installName = `uninstall-source-${counter}`;
  const name = `test-uninstall-${counter}`;
  const extensionId = `test.uninstall-${counter}`;
  const displayName = `Uninstall ${counter}`;
  const sourcePath = createTestExtensionSource({
    displayName,
    installName,
    name,
    root: tempRoot,
    version: "1.0.0",
  });

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName,
    extensionId,
    installName,
    manifest: { id: extensionId, name, displayName },
    name,
    projectId,
    sourcePath,
    version: "1.0.0",
  });

  return {
    instanceId: result.instance.id,
    installedExtensionId: result.installedSource.id,
    installName,
  };
};

describe("DELETE /v1/projects/:projectId/extensions/:instanceId", () => {
  test("removes the instance and preserves the installed source", async () => {
    const project = await createProject("Uninstall Project");
    const { instanceId, installName } = await seedEnabledInstance(project.id);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const listRes = await app.request(`/v1/projects/${project.id}/extensions`);
    const list = await listRes.json();
    expect(list.extensions.find((entry: { id: string }) => entry.id === instanceId)).toBeUndefined();

    const stillInstalled = await handle.deps.extensionService.getInstalledSource(installName);
    expect(stillInstalled).not.toBeNull();
    expect(stillInstalled?.install_name).toBe(installName);
  });

  test("returns 404 when the instance belongs to another project", async () => {
    const owner = await createProject("Uninstall Owner");
    const stranger = await createProject("Uninstall Stranger");
    const { instanceId } = await seedEnabledInstance(owner.id);

    const res = await app.request(`/v1/projects/${stranger.id}/extensions/${instanceId}`, { method: "DELETE" });
    expect(res.status).toBe(404);

    const listRes = await app.request(`/v1/projects/${owner.id}/extensions`);
    const list = await listRes.json();
    expect(list.extensions.find((entry: { id: string }) => entry.id === instanceId)).toBeDefined();
  });

  test("returns 404 for unknown instance id", async () => {
    const project = await createProject("Uninstall Missing");

    const res = await app.request(`/v1/projects/${project.id}/extensions/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
