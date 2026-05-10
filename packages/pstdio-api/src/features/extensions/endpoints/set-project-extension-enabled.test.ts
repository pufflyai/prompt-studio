import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";
import type { AppBindings } from "../../../types";

type AppHandle = Awaited<ReturnType<typeof createApp>>;

let app: OpenAPIHono<AppBindings>;
let handle: AppHandle;
let tempRoot: string;
let counter = 0;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-set-project-extension-enabled-test-"));
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
  const installName = `toggle-source-${counter}`;
  const namespace = `test.toggle.${counter}`;
  const extensionId = `test.toggle-${counter}`;

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: `Toggle ${counter}`,
    extensionId,
    installName,
    manifest: { id: extensionId, namespace, name: `Toggle ${counter}` },
    namespace,
    projectId,
    sourcePath: join(tempRoot, "extensions", installName),
    version: "1.0.0",
  });

  return { instanceId: result.instance.id, installedExtensionId: result.installedSource.id };
};

describe("PATCH /v1/projects/:projectId/extensions/:instanceId", () => {
  test("flips enabled to false", async () => {
    const project = await createProject("Toggle Disable Project");
    const { instanceId } = await seedEnabledInstance(project.id);

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.id).toBe(instanceId);

    const listRes = await app.request(`/v1/projects/${project.id}/extensions`);
    const list = await listRes.json();
    const row = list.extensions.find((entry: { id: string }) => entry.id === instanceId);
    expect(row?.enabled).toBe(false);
  });

  test("flips enabled back to true", async () => {
    const project = await createProject("Toggle Enable Project");
    const { instanceId } = await seedEnabledInstance(project.id);

    await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  test("returns 404 when instance belongs to a different project", async () => {
    const projectA = await createProject("Toggle Owner Project");
    const projectB = await createProject("Toggle Stranger Project");
    const { instanceId } = await seedEnabledInstance(projectA.id);

    const res = await app.request(`/v1/projects/${projectB.id}/extensions/${instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);

    const listRes = await app.request(`/v1/projects/${projectA.id}/extensions`);
    const list = await listRes.json();
    const row = list.extensions.find((entry: { id: string }) => entry.id === instanceId);
    expect(row?.enabled).toBe(true);
  });

  test("returns 404 for unknown instance id", async () => {
    const project = await createProject("Toggle Missing Instance Project");

    const res = await app.request(`/v1/projects/${project.id}/extensions/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);
  });
});
