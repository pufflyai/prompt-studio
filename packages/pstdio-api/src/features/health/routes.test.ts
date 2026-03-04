import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-health-test-"));
  app = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /healthz", () => {
  test("returns ok", async () => {
    const res = await app.request("/healthz");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /readyz", () => {
  test("returns ready", async () => {
    const res = await app.request("/readyz");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.database).toBe(true);
    expect(body.checks.storage).toBe(true);
  });
});

describe("GET /ping", () => {
  test("returns ok", async () => {
    const res = await app.request("/ping");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /openapi.json", () => {
  test("returns spec", async () => {
    const res = await app.request("/openapi.json");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.openapi).toBe("3.0.0");
    expect(body.info.title).toBe("Demo API Service");
  });
});
