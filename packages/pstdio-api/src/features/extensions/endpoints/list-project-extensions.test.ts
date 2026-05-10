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

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-project-extensions-test-"));
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

const seedInstance = async (
  projectId: string,
  fields: {
    namespace: string;
    extensionId: string;
    displayName: string;
    installName: string;
    enabled?: boolean;
    version?: string | null;
  },
) => {
  const installedSource = await handle.deps.extensionService.registerInstalledSource({
    displayName: fields.displayName,
    extensionId: fields.extensionId,
    installName: fields.installName,
    manifest: { id: fields.extensionId, namespace: fields.namespace, name: fields.displayName },
    namespace: fields.namespace,
    sourcePath: join(tempRoot, "extensions", fields.installName),
    version: fields.version ?? null,
  });

  const result = await handle.deps.extensionService.enableInstalledSourceForProject({
    displayName: fields.displayName,
    extensionId: fields.extensionId,
    installName: fields.installName,
    manifest: { id: fields.extensionId, namespace: fields.namespace, name: fields.displayName },
    namespace: fields.namespace,
    projectId,
    sourcePath: installedSource.source_path,
    version: fields.version ?? null,
  });

  if (fields.enabled === false) {
    await handle.deps.extensionService.setProjectExtensionEnabled(result.instance.id, false);
  }

  return { instanceId: result.instance.id, installedExtensionId: result.installedSource.id };
};

describe("GET /v1/projects/:projectId/extensions", () => {
  test("lists both enabled and disabled instances with source metadata", async () => {
    const project = await createProject("Extensions List Project");

    const enabled = await seedInstance(project.id, {
      namespace: "core.list-enabled",
      extensionId: "test.list-enabled",
      displayName: "List Enabled",
      installName: "list-enabled-source",
      version: "1.2.3",
    });

    const disabled = await seedInstance(project.id, {
      namespace: "core.list-disabled",
      extensionId: "test.list-disabled",
      displayName: "List Disabled",
      installName: "list-disabled-source",
      enabled: false,
    });

    const res = await app.request(`/v1/projects/${project.id}/extensions`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.extensions)).toBe(true);

    const byId = new Map<string, (typeof body.extensions)[number]>(
      body.extensions.map((entry: { id: string }) => [entry.id, entry]),
    );

    const enabledRow = byId.get(enabled.instanceId);
    expect(enabledRow).toBeDefined();
    expect(enabledRow?.enabled).toBe(true);
    expect(enabledRow?.namespace).toBe("core.list-enabled");
    expect(enabledRow?.displayName).toBe("List Enabled");
    expect(enabledRow?.installName).toBe("list-enabled-source");
    expect(enabledRow?.installedExtensionId).toBe(enabled.installedExtensionId);
    expect(enabledRow?.extensionId).toBe("test.list-enabled");
    expect(enabledRow?.version).toBe("1.2.3");
    expect(enabledRow?.sourcePath).toContain("list-enabled-source");
    expect(enabledRow?.projectId).toBe(project.id);

    const disabledRow = byId.get(disabled.instanceId);
    expect(disabledRow).toBeDefined();
    expect(disabledRow?.enabled).toBe(false);
    expect(disabledRow?.namespace).toBe("core.list-disabled");
  });

  test("returns 404 when project does not exist", async () => {
    const res = await app.request("/v1/projects/missing-project/extensions");
    expect(res.status).toBe(404);
  });
});
