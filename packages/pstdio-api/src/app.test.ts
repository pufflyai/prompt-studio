import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "./app";
import type { RuntimeHost } from "./features/runtime/routes";
import type { AppBindings } from "./types";

setDefaultTimeout(10_000);

let app: OpenAPIHono<AppBindings>;
let appWithAuth: OpenAPIHono<AppBindings>;
let appWithRuntime: OpenAPIHono<AppBindings>;
let tempRoot: string;
let closeDb: () => Promise<void>;
let closeDbAuth: () => Promise<void>;
let closeDbRuntime: () => Promise<void>;

const runtimeOrigin = "http://127.0.0.1:43123";

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-app-test-"));

  const result = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = result.app;
  closeDb = result.close;

  const resultAuth = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage-auth"),
    filesRoot: "",
    apiToken: "test-token",
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
  const resultRuntime = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage-runtime"),
    filesRoot: "",
    runtimeHost,
  });
  appWithRuntime = resultRuntime.app;
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
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("Secure");
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
