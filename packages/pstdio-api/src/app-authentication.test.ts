import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createTestApp } from "./test-utils/create-test-app";

setDefaultTimeout(10_000);

let handle: Awaited<ReturnType<typeof createTestApp>>;

beforeAll(async () => {
  handle = await createTestApp({ host: { kind: "standalone", token: "test-token" } });
});

afterAll(async () => {
  await handle?.close();
});

describe("api authentication", () => {
  test("returns 401 when token is missing", async () => {
    const res = await handle.app.request("/v1/projects");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("returns 401 when token is invalid", async () => {
    const res = await handle.app.request("/v1/projects", {
      headers: {
        Authorization: "Bearer wrong-token",
      },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("allows requests with a valid bearer token", async () => {
    const res = await handle.app.request("/v1/projects", {
      headers: {
        Authorization: "Bearer test-token",
      },
    });

    expect(res.status).toBe(200);
  });

  test("allows requests with lowercase bearer scheme", async () => {
    const res = await handle.app.request("/v1/projects", {
      headers: {
        Authorization: "bearer test-token",
      },
    });

    expect(res.status).toBe(200);
  });

  test("allows requests with extra whitespace around token", async () => {
    const res = await handle.app.request("/v1/projects", {
      headers: {
        Authorization: "Bearer   test-token   ",
      },
    });

    expect(res.status).toBe(200);
  });

  test("keeps health endpoints public", async () => {
    const res = await handle.app.request("/healthz");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("rejects unauthenticated CORS preflight requests when no browser origin is configured", async () => {
    const res = await handle.app.request("/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
