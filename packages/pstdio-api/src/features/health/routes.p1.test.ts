import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../test-utils/create-test-app";
import type { AppBindings } from "../../types";
import { writeExtension } from "../extensions/default-extensions-test-fixtures";
import { loadExtensionSource } from "../extensions/extension-runtime";

let app: OpenAPIHono<AppBindings>;
let closeApp: () => Promise<void>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-health-test-"));
  ({ app, close: closeApp } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  }));
});

afterAll(async () => {
  await closeApp();
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
  });
});

test("an explicit runtime diagnostic read returns numeric owner counters and heap measurements", async () => {
  const response = await app.request("/diagnostics/performance");
  expect(response.status).toBe(200);
  const reading = await response.json();
  expect(reading.pid).toBe(process.pid);
  expect(reading.heapUsedBytes).toBeGreaterThan(0);
  expect(reading.externalBytes).toBeGreaterThanOrEqual(0);
  expect(reading.counters).toMatchObject({ activeSessions: 0, retainedMessages: 0, queuedEvents: 0 });
});

test("extension imports count worker definition reads, not loads the stored definition answers", async () => {
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  const imports = async () => (await (await app.request("/diagnostics/performance")).json()).counters.extensionImports;
  try {
    const source = join(tempRoot, "extensions", "counted");
    writeExtension(source, "counted");
    const before = await imports();
    await loadExtensionSource(source);
    await loadExtensionSource(source);
    expect((await imports()) - before).toBe(1);
  } finally {
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
  }
});
