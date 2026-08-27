import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { createMemoryConnectionSecretStore } from "./connection-secret-store";

const RUNTIME_TOKEN = "runtime-test-token";
let closeApp: () => Promise<void>;
let tempRoot: string;
let previousFetch: typeof fetch;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const writeConnectionExtension = (root: string) => {
  const extensionRoot = join(root, "extensions", "connection-test");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "connection-test",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(
    join(extensionRoot, "extension.ts"),
    `export default {
      connections: [{
        id: "control-plane",
        ref: { kind: "connection", id: "control-plane" },
        label: "Control plane",
        transport: "http",
        auth: { type: "bearer" },
        allowedMethods: ["GET"],
        allowedPathPrefixes: ["/v1/workspaces"],
        check: { method: "GET", path: "/v1/workspaces/health" },
      }],
    };`,
  );
  return extensionRoot;
};

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-connections-test-"));
  previousFetch = globalThis.fetch;
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
});

afterEach(async () => {
  await closeApp?.();
  globalThis.fetch = previousFetch;
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("extension connection routes", () => {
  test("stores credentials outside API records and injects them into allowed requests", async () => {
    const remoteFetch = mock(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer credential-canary");
      return Response.json({ id: "remote-1" });
    });
    globalThis.fetch = remoteFetch as unknown as typeof fetch;
    const created = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      host: { kind: "standalone", token: RUNTIME_TOKEN },
      connectionSecretStore: createMemoryConnectionSecretStore(),
    });
    closeApp = created.close;
    const runtimeRequest = (path: string, init: RequestInit = {}) =>
      created.app.request(path, {
        ...init,
        headers: {
          authorization: `Bearer ${RUNTIME_TOKEN}`,
          ...Object.fromEntries(new Headers(init.headers).entries()),
        },
      });
    const projectResponse = await runtimeRequest("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Connection Project" }),
    });
    const projectId = (await projectResponse.json()).id;
    const sourcePath = writeConnectionExtension(tempRoot);
    const enableResponse = await runtimeRequest(
      `/v1/projects/${projectId}/extensions/installed/connection-test/enable`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Connection Test",
          extensionId: "pstdio.connection-test",
          manifest: { id: "pstdio.connection-test", name: "connection-test" },
          name: "connection-test",
          sourceHash: null,
          sourceKind: "local_path",
          sourcePath,
          sourceRef: null,
          version: null,
        }),
      },
    );
    expect(enableResponse.status).toBe(200);

    const connectionPath = `/v1/projects/${projectId}/extension-connections/pstdio.connection-test/control-plane`;
    const configured = await runtimeRequest(connectionPath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://control.example.test", secret: "credential-canary" }),
    });
    expect(configured.status).toBe(200);
    expect(JSON.stringify(await configured.json())).not.toContain("credential-canary");

    const listed = await runtimeRequest(`/v1/projects/${projectId}/extension-connections`);
    expect(listed.status).toBe(200);
    expect(JSON.stringify(await listed.json())).not.toContain("credential-canary");

    const check = await runtimeRequest(`${connectionPath}/check`, { method: "POST" });
    expect(check.status).toBe(200);
    expect(await check.json()).toMatchObject({ lastCheck: { ok: true, status: 200, error: null } });

    const response = await created.deps.extensionConnectionService.request({
      projectId,
      extensionId: "pstdio.connection-test",
      connectionId: "control-plane",
      input: { method: "GET", path: "/v1/workspaces/remote-1" },
    });
    expect(response.body).toEqual({ id: "remote-1" });
    expect(remoteFetch).toHaveBeenCalledTimes(2);
    const checked = await runtimeRequest(`/v1/projects/${projectId}/extension-connections`);
    expect(await checked.json()).toMatchObject({
      connections: [{ lastCheck: { ok: true, status: 200, error: null } }],
    });
  });
});
