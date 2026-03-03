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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-remove-agent-test-"));
  app = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("DELETE /v1/agents/:agentId", () => {
  test("returns 404 for non-existent agent", async () => {
    const res = await app.request("/v1/agents/unknown", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Agent not found");
  });

  test("removes a configured agent", async () => {
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });

    const res = await app.request("/v1/agents/claude-code", {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const listRes = await app.request("/v1/agents");
    const agents = await listRes.json();
    expect(agents).toEqual([]);
  });

  test("reassigns default after removing default agent", async () => {
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "claude-code" }),
    });
    await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "opencode" }),
    });

    await app.request("/v1/agents/claude-code", { method: "DELETE" });

    const listRes = await app.request("/v1/agents");
    const agents = await listRes.json();
    expect(agents).toHaveLength(1);
    expect(agents[0].agent_id).toBe("opencode");
    expect(agents[0].is_default).toBe(true);
  });
});
