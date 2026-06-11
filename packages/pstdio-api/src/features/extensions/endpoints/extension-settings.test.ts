import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";
import { testHarnessId } from "../../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;
let projectId: string;
let instanceId: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const installName = "settings-lab";

const writeSettingsExtension = (root: string) => {
  const extensionRoot = join(root, "extensions", installName);
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: installName,
      version: "1.0.0",
      displayName: "Settings Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      settings: {
        properties: {
          "counter.step": { type: "number", scope: "project", default: 1 },
          "counter.enabled": { type: "boolean", scope: "project", default: true },
          "greeting.tone": {
            type: "string",
            scope: "global",
            enum: ["friendly", "formal"],
            default: "friendly",
          },
        },
      },
    };`,
  );
  return extensionRoot;
};

const postJson = async (path: string, body: unknown) => {
  const response = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
};

const putJson = (path: string, body: unknown) =>
  app.request(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-settings-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";

  const created = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = created.app;
  closeApp = created.close;

  const project = await postJson("/v1/projects", { name: "Settings Project", agents: [testHarnessId("opencode")] });
  projectId = project.id;

  const sourcePath = writeSettingsExtension(tempRoot);
  const enableResponse = await app.request(`/v1/projects/${projectId}/extensions/installed/${installName}/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Settings Lab",
      extensionId: "pstdio.settings-lab",
      manifest: { id: "pstdio.settings-lab", name: installName },
      name: installName,
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    }),
  });
  expect(enableResponse.status).toBe(200);
  const enabled = await enableResponse.json();
  instanceId = enabled.instanceId;
});

afterEach(async () => {
  await closeApp();
  if (previousPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHome;
  }
  if (previousDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension settings endpoints", () => {
  test("gets declared settings through validation", async () => {
    const declared = await app.request(`/v1/projects/${projectId}/extensions/${instanceId}/settings/counter.step`);
    expect(declared.status).toBe(200);
    await expect(declared.json()).resolves.toMatchObject({ key: "counter.step", value: 1, source: "default" });

    const unknown = await app.request(`/v1/projects/${projectId}/extensions/${instanceId}/settings/missing`);
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({ code: "extension_setting_unknown_key" });
  });

  test("lists defaults and stores settings by declared scope", async () => {
    const projectList = await app.request(`/v1/projects/${projectId}/extensions/${instanceId}/settings`);
    expect(projectList.status).toBe(200);
    const projectBody = await projectList.json();
    expect(projectBody.settings).toContainEqual(
      expect.objectContaining({ key: "counter.step", value: 1, source: "default" }),
    );
    expect(projectBody.settings).toContainEqual(
      expect.objectContaining({ key: "greeting.tone", value: "friendly", source: "default" }),
    );

    const projectUpdate = await putJson(`/v1/projects/${projectId}/extensions/${instanceId}/settings/counter.step`, {
      value: 3,
    });
    expect(projectUpdate.status).toBe(200);
    await putJson(`/v1/extensions/installed/${installName}/settings/greeting.tone`, { value: "formal" });

    const updatedProjectList = await app.request(`/v1/projects/${projectId}/extensions/${instanceId}/settings`);
    const updatedProjectBody = await updatedProjectList.json();
    expect(updatedProjectBody.settings).toContainEqual(
      expect.objectContaining({ key: "counter.step", value: 3, source: "stored" }),
    );
    expect(updatedProjectBody.settings).toContainEqual(
      expect.objectContaining({ key: "greeting.tone", value: "formal", source: "stored" }),
    );

    const globalList = await app.request(`/v1/extensions/installed/${installName}/settings`);
    const globalBody = await globalList.json();
    expect(globalBody.settings).toEqual([
      expect.objectContaining({ key: "greeting.tone", value: "formal", source: "stored" }),
    ]);
  });

  test("rejects unknown keys, invalid values, and scope mismatches", async () => {
    const unknown = await putJson(`/v1/projects/${projectId}/extensions/${instanceId}/settings/missing`, {
      value: true,
    });
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({ code: "extension_setting_unknown_key" });

    const invalid = await putJson(`/v1/projects/${projectId}/extensions/${instanceId}/settings/counter.enabled`, {
      value: "yes",
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ code: "extension_setting_invalid" });

    const wrongScope = await putJson(`/v1/extensions/installed/${installName}/settings/counter.step`, { value: 2 });
    expect(wrongScope.status).toBe(400);
    await expect(wrongScope.json()).resolves.toMatchObject({ code: "extension_settings_scope_mismatch" });
  });
});
