import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentId, AgentService, AvailabilityInfo } from "pstdio-agents";
import { createApp } from "../../../app";

const createTestAgent = (id: AgentId, availability: AvailabilityInfo): AgentService =>
  ({
    id,
    name: id,
    capabilities: () => [],
    checkAvailability: () => availability,
    listModels: () => [],
    startSession: async () => ({}),
    resumeSession: async () => ({}),
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "session", title: "Session" }, messages: [] }),
    launchSession: async () => ({}),
  }) as unknown as AgentService;

const createTestApp = async (agents: AgentService[]) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-setup-available-test-"));
  const handle = await createApp({
    agents,
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });

  return {
    app: handle.app,
    close: async () => {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
};

describe("POST /v1/agents/setup-available", () => {
  test("sets up only installed agents", async () => {
    const { app, close } = await createTestApp([
      createTestAgent("claude-code", { type: "INSTALLED" }),
      createTestAgent("opencode", { type: "NOT_FOUND" }),
    ]);

    try {
      const res = await app.request("/v1/agents/setup-available", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_agent_id: "claude-code" }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toEqual([
        expect.objectContaining({
          agent_id: "claude-code",
          is_default: true,
        }),
      ]);
    } finally {
      await close();
    }
  });

  test("marks the requested installed agent as default", async () => {
    const { app, close } = await createTestApp([
      createTestAgent("claude-code", { type: "INSTALLED" }),
      createTestAgent("opencode", { type: "INSTALLED" }),
    ]);

    try {
      const res = await app.request("/v1/agents/setup-available", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_agent_id: "opencode" }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      const defaultAgent = body.find((agent: { is_default: boolean }) => agent.is_default);
      expect(defaultAgent.agent_id).toBe("opencode");
    } finally {
      await close();
    }
  });

  test("is idempotent", async () => {
    const { app, close } = await createTestApp([
      createTestAgent("claude-code", { type: "INSTALLED" }),
      createTestAgent("opencode", { type: "INSTALLED" }),
    ]);

    try {
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
      expect(body1.map((agent: { agent_id: string }) => agent.agent_id).sort()).toEqual(["claude-code", "opencode"]);
      expect(body2.map((agent: { agent_id: string }) => agent.agent_id).sort()).toEqual(["claude-code", "opencode"]);
    } finally {
      await close();
    }
  });
});
