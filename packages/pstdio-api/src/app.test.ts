import { afterAll, beforeAll, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "./app";
import type { AppBindings } from "./types";

setDefaultTimeout(10_000);

let app: OpenAPIHono<AppBindings>;
let appWithAuth: OpenAPIHono<AppBindings>;
let tempRoot: string;
let closeDb: () => Promise<void>;
let closeDbAuth: () => Promise<void>;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-app-test-"));

  const result = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
  app = result.app;
  closeDb = result.close;

  const resultAuth = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage-auth"),
    apiToken: "test-token",
  });
  appWithAuth = resultAuth.app;
  closeDbAuth = resultAuth.close;
});

afterAll(async () => {
  await closeDb();
  await closeDbAuth();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("onError handler", () => {
  test("returns 500 with generic message for unhandled errors", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);

    // Request a non-existent route that triggers an internal path causing an error
    // We use an endpoint that will throw when the underlying service fails
    // Closing the DB and making a request will cause an unhandled service error
    // Instead, we test by adding a throwing middleware for this test
    app.get("/test-error", () => {
      throw new Error("test unhandled error");
    });

    const res = await app.request("/test-error");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });

    // Verify structured JSON was written to stderr
    const calls = stderrSpy.mock.calls;
    const errorLog = calls.find((call) => {
      try {
        const parsed = JSON.parse(call[0] as string);
        return parsed.message === "test unhandled error";
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

    stderrSpy.mockRestore();
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

  test("allows unauthenticated CORS preflight requests", async () => {
    const res = await appWithAuth.request("/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
