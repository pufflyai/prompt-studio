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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-setup-agent-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/agents", () => {
  test("creates a new agent config", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent_id).toBe("claude-code");
    expect(body.is_default).toBe(true);
  });

  test("is idempotent for same agent_id", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent_id).toBe("claude-code");
  });

  test("second agent is not default", async () => {
    const res = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "opencode" }),
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent_id).toBe("opencode");
    expect(body.is_default).toBe(false);
  });
});
