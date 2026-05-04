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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-project-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async (name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

describe("PATCH /v1/projects/:id", () => {
  test("returns 404 for missing project", async () => {
    const res = await app.request("/v1/projects/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "claude-code" }),
    });

    expect(res.status).toBe(404);
  });

  test("persists default agent and model", async () => {
    const project = await createProject("Patch Default Agent");

    const patchRes = await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        default_agent_id: "claude-code",
        default_agent_model: "claude-3-5-sonnet",
      }),
    });

    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.default_agent_id).toBe("claude-code");
    expect(updated.default_agent_model).toBe("claude-3-5-sonnet");

    const getRes = await app.request(`/v1/projects/${project.id}`);
    const fetched = await getRes.json();
    expect(fetched.default_agent_id).toBe("claude-code");
    expect(fetched.default_agent_model).toBe("claude-3-5-sonnet");
  });

  test("clears default model independently of agent", async () => {
    const project = await createProject("Clear Default Model");

    await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "claude-code", default_agent_model: "claude-3-5-sonnet" }),
    });

    const clearRes = await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_model: null }),
    });

    expect(clearRes.status).toBe(200);
    const updated = await clearRes.json();
    expect(updated.default_agent_id).toBe("claude-code");
    expect(updated.default_agent_model).toBeNull();
  });

  test("returns 400 when body is empty", async () => {
    const project = await createProject("Empty Patch Body");

    const res = await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
