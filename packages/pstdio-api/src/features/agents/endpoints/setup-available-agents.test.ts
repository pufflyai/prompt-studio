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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-setup-available-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/agents/setup-available", () => {
  test("sets up all available agents", async () => {
    const res = await app.request("/v1/agents/setup-available", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toBeArray();
    expect(body.length).toBeGreaterThanOrEqual(1);

    const claudeCode = body.find((a: { agent_id: string }) => a.agent_id === "claude-code");
    expect(claudeCode).toBeDefined();
    expect(claudeCode.is_default).toBe(true);
  });

  test("marks specified agent as default", async () => {
    const res = await app.request("/v1/agents/setup-available", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "opencode" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    const defaultAgent = body.find((a: { is_default: boolean }) => a.is_default);
    expect(defaultAgent.agent_id).toBe("opencode");
  });

  test("is idempotent", async () => {
    const res1 = await app.request("/v1/agents/setup-available", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "claude-code" }),
    });
    const res2 = await app.request("/v1/agents/setup-available", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "claude-code" }),
    });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.length).toBe(body2.length);
  });
});
