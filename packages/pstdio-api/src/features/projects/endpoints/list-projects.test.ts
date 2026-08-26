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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-projects-test-"));
  ({ app } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/projects", () => {
  test("returns empty array when no projects exist", async () => {
    const res = await app.request("/v1/projects");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([]);
  });

  test("returns all projects", async () => {
    await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project A" }),
    });

    await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project B" }),
    });

    const res = await app.request("/v1/projects");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.length).toBe(2);
    expect(body[0].name).toBe("Project A");
    expect(body[1].name).toBe("Project B");
  });

  test("returns 400 when unknown query params are provided", async () => {
    const res = await app.request("/v1/projects?x=1");
    expect(res.status).toBe(400);
  });
});
