import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { ExtensionWebviewAccess } from "./features/extensions/extension-webview-access";
import type { RuntimeHost } from "./features/runtime/routes";
import { createTestApp } from "./test-utils/create-test-app";
import type { AppBindings } from "./types";

setDefaultTimeout(10_000);

let app: OpenAPIHono<AppBindings>;
let appWithAuth: OpenAPIHono<AppBindings>;
let appWithRuntime: OpenAPIHono<AppBindings>;
let tempRoot: string;
let closeDb: () => Promise<void>;
let closeDbAuth: () => Promise<void>;
let closeDbRuntime: () => Promise<void>;
let unsecuredWebviewAccess: ExtensionWebviewAccess;
let runtimeWebviewAccess: ExtensionWebviewAccess;

const runtimeOrigin = "http://127.0.0.1:43123";

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-app-test-"));

  const result = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });
  app = result.app;
  closeDb = result.close;
  unsecuredWebviewAccess = result.deps.extensionWebviewAccess;

  const resultAuth = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage-auth"),
    host: { kind: "standalone", token: "test-token" },
  });
  appWithAuth = resultAuth.app;
  closeDbAuth = resultAuth.close;

  const runtimeHost: RuntimeHost = {
    announceShutdown: () => {},
    instanceId: "runtime-one",
    origin: () => runtimeOrigin,
    ownerType: () => "persistent",
    promote: async () => {},
    shutdown: async () => {},
    subscribe: () => () => {},
    token: "runtime-secret",
  };
  const resultRuntime = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage-runtime"),
    host: { kind: "runtime", runtime: runtimeHost },
  });
  appWithRuntime = resultRuntime.app;
  runtimeWebviewAccess = resultRuntime.deps.extensionWebviewAccess;
  appWithRuntime.get("/v1/test-secret-error", () => {
    throw new Error("failed with runtime-secret");
  });
  closeDbRuntime = resultRuntime.close;
});

afterAll(async () => {
  await closeDb();
  await closeDbAuth();
  await closeDbRuntime();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("onError handler", () => {
  test("returns 500 with the error message and stable code for unhandled errors", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);
    const stdoutSpy = spyOn(process.stdout, "write").mockReturnValue(true);

    // Request a non-existent route that triggers an internal path causing an error
    // We use an endpoint that will throw when the underlying service fails
    // Closing the DB and making a request will cause an unhandled service error
    // Instead, we test by adding a throwing middleware for this test
    app.get("/test-error", () => {
      throw new Error("test unhandled error");
    });

    const res = await app.request("/test-error");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "internal_server_error", error: "test unhandled error" });

    // Verify structured JSON was written to stdout via shared logger.
    const stdoutCalls = stdoutSpy.mock.calls;
    const errorLog = stdoutCalls.find((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.event === "api.request.error" && parsed.message === "test unhandled error";
      } catch {
        return false;
      }
    });
    expect(errorLog).toBeDefined();

    const parsed = JSON.parse(errorLog![0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/test-error");
    expect(parsed.status).toBe(500);

    // Legacy per-error stderr JSON persistence was removed.
    const stderrCalls = stderrSpy.mock.calls;
    const hasStructuredStderrError = stderrCalls.some((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.message === "test unhandled error";
      } catch {
        return false;
      }
    });
    expect(hasStructuredStderrError).toBe(false);

    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });
});

describe("api authentication", () => {
  test("returns 401 when token is missing", async () => {
    const res = await appWithAuth.request("/v1/projects");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 when token is invalid", async () => {
    const res = await appWithAuth.request("/v1/projects", {
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("allows requests with a valid bearer token", async () => {
    const res = await appWithAuth.request("/v1/projects", {
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    expect(res.status).toBe(200);
  });

  test("allows requests with lowercase bearer scheme", async () => {
    const res = await appWithAuth.request("/v1/projects", {
      headers: {
        Authorization: "bearer test-token",
      },
    });

    expect(res.status).toBe(200);
  });

  test("allows requests with extra whitespace around token", async () => {
    const res = await appWithAuth.request("/v1/projects", {
      headers: {
        Authorization: "Bearer   test-token   ",
      },
    });

    expect(res.status).toBe(200);
  });

  test("keeps health endpoints public", async () => {
    const res = await appWithAuth.request("/healthz");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("rejects unauthenticated CORS preflight requests when no browser origin is configured", async () => {
    const res = await appWithAuth.request("/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("allows signed opaque-origin extension assets without runtime transport security", async () => {
    const basePath = unsecuredWebviewAccess
      .runtimeUrl({ installName: "missing", webviewId: "missing" })
      .replace(/\/runtime$/, "");
    const res = await app.request(`http://127.0.0.1:43123${basePath}/runtime`, {
      headers: { origin: "null" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("null");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("vary")).toContain("Origin");
  });

  test("provisions an HttpOnly strict session cookie without returning the token", async () => {
    const res = await appWithRuntime.request(`${runtimeOrigin}/runtime/browser-session`, {
      method: "POST",
      headers: {
        authorization: "Bearer runtime-secret",
        origin: runtimeOrigin,
      },
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.getSetCookie()).toEqual([
      "pstdio_runtime_session=runtime-secret; Path=/; HttpOnly; SameSite=Strict",
    ]);
  });

  test("accepts exact-origin cookie auth for REST and SSE", async () => {
    const provision = await appWithRuntime.request(`${runtimeOrigin}/runtime/browser-session`, {
      method: "POST",
      headers: { authorization: "Bearer runtime-secret", origin: runtimeOrigin },
    });
    const cookie = provision.headers.get("set-cookie")!.split(";", 1)[0]!;

    const rest = await appWithRuntime.request(`${runtimeOrigin}/v1/projects`, {
      headers: { cookie, origin: runtimeOrigin },
    });
    expect(rest.status).toBe(200);

    const controller = new AbortController();
    const sse = await appWithRuntime.request(`${runtimeOrigin}/v1/sync/stream`, {
      headers: { cookie, origin: runtimeOrigin },
      signal: controller.signal,
    });
    expect(sse.status).toBe(200);
    expect(sse.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
    await sse.body?.cancel();
  });

  test("allows signed read-only webview assets from opaque origins without cookies", async () => {
    const basePath = runtimeWebviewAccess
      .runtimeUrl({ installName: "missing", webviewId: "missing" })
      .replace(/\/runtime$/, "");

    for (const path of [`${basePath}/runtime`, `${basePath}/assets/module.js`]) {
      const response = await appWithRuntime.request(`${runtimeOrigin}${path}`, {
        headers: { origin: "null" },
      });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBe("null");
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
      expect(response.headers.get("vary")).toContain("Origin");
    }

    const head = await appWithRuntime.request(`${runtimeOrigin}${basePath}/runtime`, {
      method: "HEAD",
      headers: { origin: "null" },
    });
    expect(head.status).not.toBe(401);
    expect(head.status).not.toBe(403);
    expect(head.headers.get("access-control-allow-origin")).toBe("null");

    const navigation = await appWithRuntime.request(`${runtimeOrigin}${basePath}/runtime`);
    expect(navigation.status).toBe(200);

    const invalidCapability = await appWithRuntime.request(`${runtimeOrigin}${basePath}x/runtime`, {
      headers: { origin: "null" },
    });
    expect(invalidCapability.status).toBe(404);

    const oldAssetPath = await appWithRuntime.request(`${runtimeOrigin}/v1/extensions/runtime.js`, {
      headers: { origin: "null" },
    });
    expect(oldAssetPath.status).toBe(403);

    const nonAsset = await appWithRuntime.request(`${runtimeOrigin}/v1/projects`, {
      headers: { origin: "null" },
    });
    expect(nonAsset.status).toBe(403);

    const mutation = await appWithRuntime.request(`${runtimeOrigin}${basePath}/runtime`, {
      method: "POST",
      headers: { origin: "null" },
    });
    expect(mutation.status).toBe(404);

    const preflight = await appWithRuntime.request(`${runtimeOrigin}${basePath}/runtime`, {
      method: "OPTIONS",
      headers: { origin: "null", "access-control-request-method": "GET" },
    });
    expect(preflight.status).toBe(404);

    const foreign = await appWithRuntime.request(`${runtimeOrigin}${basePath}/runtime`, {
      headers: { origin: "http://attacker.example" },
    });
    expect(foreign.status).toBe(403);
  });

  test("invalidates webview capabilities when the runtime is replaced", async () => {
    const staleRuntimeUrl = unsecuredWebviewAccess.runtimeUrl({ installName: "missing", webviewId: "missing" });
    const response = await appWithRuntime.request(`${runtimeOrigin}${staleRuntimeUrl}`, {
      headers: { origin: "null" },
    });

    expect(response.status).toBe(404);
  });

  test("rejects arbitrary origins and unauthenticated WebSocket handshakes", async () => {
    const foreign = await appWithRuntime.request(`${runtimeOrigin}/v1/projects`, {
      headers: { authorization: "Bearer runtime-secret", origin: "http://attacker.example" },
    });
    expect(foreign.status).toBe(403);

    const websocket = await appWithRuntime.request(`${runtimeOrigin}/v1/terminal`, {
      headers: { connection: "Upgrade", origin: runtimeOrigin, upgrade: "websocket" },
    });
    expect(websocket.status).toBe(401);
  });

  test("allows only exact-origin credentialed preflights", async () => {
    const exact = await appWithRuntime.request(`${runtimeOrigin}/v1/projects`, {
      method: "OPTIONS",
      headers: { origin: runtimeOrigin, "access-control-request-method": "GET" },
    });
    expect(exact.status).toBe(204);
    expect(exact.headers.get("access-control-allow-origin")).toBe(runtimeOrigin);
    expect(exact.headers.get("access-control-allow-credentials")).toBe("true");

    const foreign = await appWithRuntime.request(`${runtimeOrigin}/v1/projects`, {
      method: "OPTIONS",
      headers: { origin: "http://attacker.example", "access-control-request-method": "GET" },
    });
    expect(foreign.status).toBe(403);
  });

  test("keeps only liveness public while protecting readiness details and API documentation", async () => {
    expect((await appWithRuntime.request(`${runtimeOrigin}/healthz`)).status).toBe(200);
    expect((await appWithRuntime.request(`${runtimeOrigin}/ping`)).status).toBe(200);
    expect((await appWithRuntime.request(`${runtimeOrigin}/readyz`)).status).toBe(401);
    expect((await appWithRuntime.request(`${runtimeOrigin}/openapi.json`)).status).toBe(401);
    expect(
      (
        await appWithRuntime.request(`${runtimeOrigin}/readyz`, {
          headers: { authorization: "Bearer runtime-secret" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await appWithRuntime.request(`${runtimeOrigin}/openapi.json`, {
          headers: { authorization: "Bearer runtime-secret" },
        })
      ).status,
    ).toBe(200);
  });

  test("redacts the runtime token from API error payloads", async () => {
    const response = await appWithRuntime.request(`${runtimeOrigin}/v1/test-secret-error`, {
      headers: { authorization: "Bearer runtime-secret" },
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("failed with [Redacted]");
  });
});

describe("app host ownership", () => {
  test("uses the runtime token when a different standalone token is present", async () => {
    const previousToken = process.env.PSTDIO_API_TOKEN;
    process.env.PSTDIO_API_TOKEN = "standalone-secret";
    const runtimeHost: RuntimeHost = {
      announceShutdown: () => {},
      instanceId: "runtime-with-ambient-token",
      origin: () => runtimeOrigin,
      ownerType: () => "persistent",
      promote: async () => {},
      shutdown: async () => {},
      subscribe: () => () => {},
      token: "runtime-secret",
    };

    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-runtime-ambient-token"),
      host: { kind: "runtime", runtime: runtimeHost },
    });

    try {
      const response = await handle.app.request(`${runtimeOrigin}/runtime/ready`, {
        headers: { authorization: "Bearer runtime-secret" },
      });

      expect(response.status).toBe(200);
    } finally {
      await handle.close();
      if (previousToken === undefined) {
        delete process.env.PSTDIO_API_TOKEN;
      } else {
        process.env.PSTDIO_API_TOKEN = previousToken;
      }
    }
  });
});
