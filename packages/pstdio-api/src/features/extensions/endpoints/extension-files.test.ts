import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";
import { testHarnessId } from "../../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;
let projectId: string;
let labInstanceId: string;
let otherInstanceId: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const writeExtension = (name: string) => {
  const extensionRoot = join(tempRoot, "extensions", name);
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      displayName: name,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(extensionRoot, "extension.ts"), "export default {};");
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

const enableExtension = async (name: string) => {
  const sourcePath = writeExtension(name);
  const response = await app.request(`/v1/projects/${projectId}/extensions/installed/${name}/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: name,
      extensionId: `pstdio.${name}`,
      manifest: { id: `pstdio.${name}`, name },
      name,
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { instanceId: string }).instanceId;
};

const uploadFile = (instanceId: string) =>
  app.request(`/v1/projects/${projectId}/extensions/${instanceId}/files?scope_type=resource&scope_id=ticket-1`, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      "x-file-name": "notes.txt",
    },
    body: "hello attachment",
  });

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-files-test-"));
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

  const project = await createJson("/v1/projects", { name: "Files Project", agents: [testHarnessId("opencode")] });
  projectId = project.id;
  labInstanceId = await enableExtension("lab");
  otherInstanceId = await enableExtension("other");
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

describe("extension file endpoints", () => {
  test("uploads, lists, and downloads files owned by an extension scope", async () => {
    const uploadResponse = await uploadFile(labInstanceId);

    expect(uploadResponse.status).toBe(201);
    const uploaded = (await uploadResponse.json()) as { id: string; name: string; size: number; url: string };
    expect(uploaded).toMatchObject({
      name: "notes.txt",
      size: Buffer.byteLength("hello attachment"),
    });
    expect(uploaded.url).toContain(
      `/v1/projects/${projectId}/extensions/${labInstanceId}/files/${uploaded.id}/content`,
    );

    const listResponse = await app.request(
      `/v1/projects/${projectId}/extensions/${labInstanceId}/files?scope_type=resource&scope_id=ticket-1`,
    );
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as { files: Array<{ id: string }> };
    expect(listed.files.map((file) => file.id)).toEqual([uploaded.id]);

    const contentResponse = await app.request(uploaded.url);
    expect(contentResponse.status).toBe(200);
    expect(await contentResponse.text()).toBe("hello attachment");
  });

  test("rejects access from another extension instance", async () => {
    const uploadResponse = await uploadFile(labInstanceId);
    const uploaded = (await uploadResponse.json()) as { id: string };

    const contentResponse = await app.request(
      `/v1/projects/${projectId}/extensions/${otherInstanceId}/files/${uploaded.id}/content`,
    );
    expect(contentResponse.status).toBe(404);
  });

  test("rejects uploads for unknown extension instances", async () => {
    const response = await uploadFile("00000000-0000-0000-0000-000000000000");

    expect(response.status).toBe(404);
  });

  test("deletes an extension file with its ownership and bytes", async () => {
    const uploadResponse = await uploadFile(labInstanceId);
    const uploaded = (await uploadResponse.json()) as { id: string; url: string };
    const fileUrl = `/v1/projects/${projectId}/extensions/${labInstanceId}/files/${uploaded.id}`;

    const deleteResponse = await app.request(fileUrl, { method: "DELETE" });
    expect(deleteResponse.status).toBe(204);

    const listResponse = await app.request(
      `/v1/projects/${projectId}/extensions/${labInstanceId}/files?scope_type=resource&scope_id=ticket-1`,
    );
    expect(((await listResponse.json()) as { files: unknown[] }).files).toEqual([]);

    const contentResponse = await app.request(uploaded.url);
    expect(contentResponse.status).toBe(404);

    const repeatedDeleteResponse = await app.request(fileUrl, { method: "DELETE" });
    expect(repeatedDeleteResponse.status).toBe(404);
  });

  test("decodes percent-encoded upload file names", async () => {
    const fileName = "メモ-😀.txt";
    const response = await app.request(`/v1/projects/${projectId}/extensions/${labInstanceId}/files`, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-file-name": encodeURIComponent(fileName),
      },
      body: "named attachment",
    });

    expect(response.status).toBe(201);
    const uploaded = (await response.json()) as { name: string };
    expect(uploaded.name).toBe(fileName);
  });

  test("returns 304 when the request etag matches the file hash", async () => {
    const uploadResponse = await uploadFile(labInstanceId);
    const uploaded = (await uploadResponse.json()) as { hash: string; url: string };

    const contentResponse = await app.request(uploaded.url, {
      headers: { "if-none-match": uploaded.hash },
    });

    expect(contentResponse.status).toBe(304);
    expect(await contentResponse.text()).toBe("");
  });

  test("returns 404 when file bytes are missing from storage", async () => {
    const uploadResponse = await uploadFile(labInstanceId);
    const uploaded = (await uploadResponse.json()) as { id: string; url: string };
    rmSync(join(tempRoot, "storage", projectId, uploaded.id), { force: true });

    const contentResponse = await app.request(uploaded.url);

    expect(contentResponse.status).toBe(404);
  });
});
