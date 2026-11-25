import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createMemoryConnectionSecretStore } from "./connection-secret-store";

const RUNTIME_TOKEN = "runtime-test-token";
let closeApp: () => Promise<void>;
let tempRoot: string;
let previousFetch: typeof fetch;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const writeConnectionExtension = (root: string, scope: "project" | "global") => {
  const extensionRoot = join(root, "extensions", "connection-test");
  mkdirSync(extensionRoot, { recursive: true });
  writeFileSync(
    join(extensionRoot, "package.json"),
    JSON.stringify({
      name: "connection-test",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
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
        scope: "${scope}",
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

const setupConnectionRoutes = async (scope: "project" | "global" = "project") => {
  const secrets = createMemoryConnectionSecretStore();
  const created = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    host: { kind: "standalone", token: RUNTIME_TOKEN },
    connectionSecretStore: secrets,
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
    body: JSON.stringify(folderProjectInput({ name: "Connection Project" })),
  });
  const projectId = (await projectResponse.json()).id;
  const sourcePath = writeConnectionExtension(tempRoot, scope);
  const enableResponse = await runtimeRequest(`/v1/projects/${projectId}/extensions/installed/connection-test/enable`, {
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
  });
  expect(enableResponse.status).toBe(200);
  const { instanceId } = await enableResponse.json();

  const connectionPath = `/v1/projects/${projectId}/extension-connections/pstdio.connection-test/control-plane`;
  return { created, projectId, instanceId, connectionPath, runtimeRequest, secrets };
};

test.each([
  "disabled",
  "uninstalled",
] as const)("selects one same-origin sign-in after an extension is %s", async (lifecycle) => {
  const { created, connectionPath, instanceId, projectId, runtimeRequest, secrets } =
    await setupConnectionRoutes("global");
  const origin = "https://control.example.test";
  const instancePath = `/v1/projects/${projectId}/extensions/${instanceId}`;
  const configure = (secret: string, credentialScope?: "project") =>
    runtimeRequest(connectionPath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: `${origin.toUpperCase()}:443/api`, secret, credentialScope }),
    });
  const revokePath = (parameters: Record<string, string>) =>
    `${connectionPath}?${new URLSearchParams({ credentialScope: "all-projects", ...parameters })}`;
  const revoke = (parameters: Record<string, string>) => runtimeRequest(revokePath(parameters), { method: "DELETE" });
  const saved = async () => (await Promise.all((await secrets.listRefs()).map(secrets.get))).sort();
  const listPath = `/v1/projects/${projectId}/extension-connections`;
  const list = async () => (await runtimeRequest(listPath)).json();
  const signIns = ["global", "shared"].map((signInScope) => ({
    extensionId: "pstdio.connection-test",
    connectionId: "control-plane",
    origin,
    signInScope,
  }));

  const global = await configure("global-canary");
  expect(await global.json()).toMatchObject({ scope: "global", configured: true });
  writeConnectionExtension(tempRoot, "project");
  expect((await runtimeRequest(`${instancePath}/reload`, { method: "POST" })).status).toBe(200);
  const shared = await configure("shared-canary");
  const sharedRecord = await shared.json();
  expect(sharedRecord).toMatchObject({ configured: true });
  expect(sharedRecord.scope).toBeUndefined();
  expect((await configure("private-canary", "project")).status).toBe(200);
  expect(await saved()).toEqual(["global-canary", "private-canary", "shared-canary"]);
  expect(await list()).toMatchObject({ connections: [{ configured: true }], savedSignIns: signIns });

  if (lifecycle === "disabled") {
    const changed = await runtimeRequest(instancePath, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(changed.status).toBe(200);
  } else {
    const removed = await runtimeRequest(`${instancePath}?deleteUserData=true`, { method: "DELETE" });
    expect(removed.status).toBe(204);
  }
  const before =
    lifecycle === "disabled"
      ? ["global-canary", "private-canary", "shared-canary"]
      : ["global-canary", "shared-canary"];
  const signInScope = lifecycle === "disabled" ? "shared" : "global";
  expect(await saved()).toEqual(before);
  expect(await list()).toEqual({ connections: [], savedSignIns: signIns });
  expect((await created.app.request(listPath)).status).toBe(401);
  expect((await revoke({ origin })).status).toBe(400);
  expect((await revoke({ signInScope })).status).toBe(400);
  expect((await revoke({ origin, signInScope, credentialScope: "project" })).status).toBe(400);
  expect((await revoke({ origin: `${origin}/api`, signInScope })).status).toBe(400);
  expect((await created.app.request(revokePath({ origin, signInScope }), { method: "DELETE" })).status).toBe(401);
  const wrongOrigin = await revoke({ origin: "https://other.example.test", signInScope });
  expect(await saved()).toEqual(before);

  const selected = await revoke({ origin: origin.toUpperCase(), signInScope });
  expect({ wrongOrigin: wrongOrigin.status, selected: selected.status, saved: await saved() }).toEqual({
    wrongOrigin: signInScope === "global" ? 400 : 204,
    selected: 204,
    saved: before.filter((secret) => secret !== `${signInScope}-canary`),
  });
  expect((await revoke({ origin, signInScope })).status).toBe(204);
  expect(await saved()).toEqual(before.filter((secret) => secret !== `${signInScope}-canary`));
  expect(await list()).toEqual({
    connections: [],
    savedSignIns: signIns.filter((signIn) => signIn.signInScope !== signInScope),
  });
});

describe("extension connection routes", () => {
  test("revokes a global sign-in only at its own origin", async () => {
    const received: (string | null)[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        received.push(request.headers.get("authorization"));
        return Response.json({ ok: true });
      },
    });
    try {
      const { connectionPath, instanceId, projectId, runtimeRequest, secrets } = await setupConnectionRoutes("global");
      const origin = server.url.origin;
      const instancePath = `/v1/projects/${projectId}/extensions/${instanceId}`;
      const configure = (secret: string) =>
        runtimeRequest(connectionPath, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseUrl: origin, secret }),
        });
      const check = async () => (await runtimeRequest(`${connectionPath}/check`, { method: "POST" })).json();
      const revoke = (origin: string) => {
        const params = new URLSearchParams({ credentialScope: "all-projects", origin });
        return runtimeRequest(`${connectionPath}?${params}`, { method: "DELETE" });
      };

      const configured = await configure("global-canary");
      expect(configured.status).toBe(200);
      expect(await configured.json()).toMatchObject({ scope: "global", configured: true });
      expect(await check()).toMatchObject({ lastCheck: { ok: true, status: 200 } });
      const originOnly = new URLSearchParams({ origin });
      expect((await runtimeRequest(`${connectionPath}?${originOnly}`, { method: "DELETE" })).status).toBe(400);
      expect((await runtimeRequest(`${connectionPath}?credentialScope=project`, { method: "DELETE" })).status).toBe(
        400,
      );
      const wrongOrigin = await revoke("https://other.example.test");
      expect(await check()).toMatchObject({ lastCheck: { ok: true, status: 200 } });
      const revoked = await revoke(origin.toUpperCase());
      const record = await check();
      expect({
        wrongOrigin: wrongOrigin.status,
        revoked: revoked.status,
        configured: record.configured,
        lastCheck: record.lastCheck,
        received,
        secretRefs: (await secrets.listRefs()).length,
      }).toEqual({
        wrongOrigin: 400,
        revoked: 204,
        configured: false,
        lastCheck: null,
        received: ["Bearer global-canary", "Bearer global-canary"],
        secretRefs: 0,
      });
      expect((await revoke(origin)).status).toBe(204);

      expect((await configure("disconnect-canary")).status).toBe(200);
      expect(
        (await runtimeRequest(`${connectionPath}?credentialScope=all-projects`, { method: "DELETE" })).status,
      ).toBe(204);
      expect(await secrets.listRefs()).toEqual([]);
      expect((await configure("disabled-canary")).status).toBe(200);
      expect(
        (
          await runtimeRequest(instancePath, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: false }),
          })
        ).status,
      ).toBe(200);
      expect(
        (await runtimeRequest(`${connectionPath}?credentialScope=all-projects`, { method: "DELETE" })).status,
      ).toBe(400);
      expect(await secrets.listRefs()).toHaveLength(1);
      expect((await revoke(origin)).status).toBe(204);
      expect(await secrets.listRefs()).toEqual([]);
      expect(
        (
          await runtimeRequest(instancePath, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: true }),
          })
        ).status,
      ).toBe(200);
      expect((await configure("uninstalled-canary")).status).toBe(200);
      expect((await runtimeRequest(`${instancePath}?deleteUserData=true`, { method: "DELETE" })).status).toBe(204);
      expect(await secrets.listRefs()).toHaveLength(1);
      expect((await revoke(origin)).status).toBe(204);
      expect(await secrets.listRefs()).toEqual([]);
    } finally {
      server.stop(true);
    }
  });

  test("stores credentials outside API records and injects them into allowed requests", async () => {
    const remoteFetch = mock(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer credential-canary");
      return Response.json({ id: "remote-1" });
    });
    globalThis.fetch = remoteFetch as unknown as typeof fetch;
    const { created, projectId, instanceId, connectionPath, runtimeRequest, secrets } = await setupConnectionRoutes();
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

    const firstOrigin = "https://control.example.test";
    const otherOrigin = "https://other.example.test";
    const configure = (baseUrl: string, secret?: string) =>
      runtimeRequest(connectionPath, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl, secret }),
      });
    const revoke = (origin?: string) => {
      const params = new URLSearchParams({ credentialScope: "all-projects" });
      if (origin) params.set("origin", origin);
      return runtimeRequest(`${connectionPath}?${params}`, { method: "DELETE" });
    };
    expect((await configure(otherOrigin, "other-credential")).status).toBe(200);
    expect((await runtimeRequest(connectionPath, { method: "DELETE" })).status).toBe(204);
    expect(await secrets.listRefs()).toHaveLength(2);
    expect(await (await runtimeRequest(`/v1/projects/${projectId}/extension-connections`)).json()).toEqual({
      connections: [],
      savedSignIns: [firstOrigin, otherOrigin].map((origin) => ({
        extensionId: "pstdio.connection-test",
        connectionId: "control-plane",
        origin,
        signInScope: "shared",
      })),
    });
    const ambiguous = await revoke();
    const explicit = await revoke(firstOrigin.toUpperCase());
    expect({
      ambiguous: ambiguous.status,
      explicit: explicit.status,
      remaining: (await secrets.listRefs()).length,
    }).toEqual({
      ambiguous: 400,
      explicit: 204,
      remaining: 1,
    });

    expect((await configure(firstOrigin)).status).toBe(400);
    expect((await configure(otherOrigin)).status).toBe(200);
    expect((await revoke(`${otherOrigin}/api`)).status).toBe(400);
    expect((await revoke(firstOrigin)).status).toBe(204);
    const stillConfigured = await runtimeRequest(`/v1/projects/${projectId}/extension-connections`);
    expect(await stillConfigured.json()).toMatchObject({
      connections: [{ baseUrl: `${otherOrigin}/`, configured: true }],
    });
    expect((await runtimeRequest(connectionPath, { method: "DELETE" })).status).toBe(204);
    expect((await revoke()).status).toBe(204);
    expect(await secrets.listRefs()).toEqual([]);
    expect((await revoke()).status).toBe(204);

    expect((await configure(firstOrigin, "disabled-credential")).status).toBe(200);
    expect((await configure(otherOrigin, "uninstalled-credential")).status).toBe(200);
    const instancePath = `/v1/projects/${projectId}/extensions/${instanceId}`;
    const disabled = await runtimeRequest(instancePath, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(disabled.status).toBe(200);
    expect(await (await runtimeRequest(`/v1/projects/${projectId}/extension-connections`)).json()).toMatchObject({
      connections: [],
    });
    expect(await secrets.listRefs()).toHaveLength(2);
    expect((await revoke(firstOrigin)).status).toBe(204);
    expect(await secrets.listRefs()).toHaveLength(1);
    expect((await runtimeRequest(`${instancePath}?deleteUserData=true`, { method: "DELETE" })).status).toBe(204);
    expect(await secrets.listRefs()).toHaveLength(1);
    expect((await revoke(otherOrigin)).status).toBe(204);
    expect(await secrets.listRefs()).toEqual([]);
  });
});
