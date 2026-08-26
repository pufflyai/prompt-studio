import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-check-agent-test-"));
  ({ app } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/agents/availability", () => {
  test("returns INSTALLED for a known agent", async () => {
    const res = await app.request("/v1/agents/availability?agent=claude-code");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBeDefined();
    expect(["INSTALLED", "NOT_FOUND"]).toContain(body.type);
  });

  test("returns NOT_FOUND for an unknown agent", async () => {
    const res = await app.request("/v1/agents/availability?agent=unknown-agent");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.type).toBe("NOT_FOUND");
  });

  test("returns 400 when agent query param is missing", async () => {
    const res = await app.request("/v1/agents/availability");

    expect(res.status).toBe(400);
  });
});
