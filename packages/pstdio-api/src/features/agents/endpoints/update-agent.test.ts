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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-agent-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("PATCH /v1/agents/:agentId", () => {
  test("returns 404 for non-existent agent", async () => {
    const res = await app.request("/v1/agents/unknown", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    expect(res.status).toBe(404);
  });

  test("sets agent as default", async () => {
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

    const res = await app.request("/v1/agents/opencode", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.agent_id).toBe("opencode");
    expect(body.is_default).toBe(true);

    const listRes = await app.request("/v1/agents");
    const agents = await listRes.json();
    const claude = agents.find((a: { agent_id: string }) => a.agent_id === "claude-code");
    expect(claude.is_default).toBe(false);
  });

  test("updates binary and skills_dir in config", async () => {
    const res = await app.request("/v1/agents/claude-code", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ binary: "/usr/local/bin/claude", skills_dir: "/custom/skills" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const config = JSON.parse(body.config);
    expect(config.binary).toBe("/usr/local/bin/claude");
    expect(config.skills_dir).toBe("/custom/skills");
  });
});
