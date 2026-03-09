import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-session-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions", () => {
  test("returns 201 and marks session failed when agent cannot start", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Session Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Session Title",
        prompt: "Run task",
        agent: "missing-agent",
      }),
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    let status = "in_progress";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const getRes = await app.request(`/v1/sessions/${created.id}`);
      expect(getRes.status).toBe(200);
      const body = await getRes.json();
      status = body.status;
      if (status === "failed") break;
      await Bun.sleep(10);
    }

    expect(status).toBe("failed");
  });
});
