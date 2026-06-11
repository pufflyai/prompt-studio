import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentAvailabilityType } from "pstdio-api-contracts";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createApp } from "../../../app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const CLAUDE_CODE_ID = testHarnessId("claude-code");
const OPENCODE_ID = testHarnessId("opencode");

const createTestApp = async (records: RuntimeHarnessRecord[]) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-setup-available-test-"));
  const handle = await createApp({
    harnessRegistry: createTestHarnessRegistry(records),
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

const record = (localId: string, availability: AgentAvailabilityType) =>
  createTestHarnessRecord(localId, { availability });

describe("POST /v1/agents/setup-available", () => {
  test("sets up only installed agents", async () => {
    const { app, close } = await createTestApp([record("claude-code", "INSTALLED"), record("opencode", "NOT_FOUND")]);

    try {
      const res = await app.request("/v1/agents/setup-available", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_agent_id: CLAUDE_CODE_ID }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toEqual([
        expect.objectContaining({
          agent_id: CLAUDE_CODE_ID,
          is_default: true,
        }),
      ]);
    } finally {
      await close();
    }
  });

  test("marks the requested installed agent as default", async () => {
    const { app, close } = await createTestApp([record("claude-code", "INSTALLED"), record("opencode", "INSTALLED")]);

    try {
      const res = await app.request("/v1/agents/setup-available", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_agent_id: OPENCODE_ID }),
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      const defaultAgent = body.find((agent: { is_default: boolean }) => agent.is_default);
      expect(defaultAgent.agent_id).toBe(OPENCODE_ID);
    } finally {
      await close();
    }
  });

  test("is idempotent", async () => {
    const { app, close } = await createTestApp([record("claude-code", "INSTALLED"), record("opencode", "INSTALLED")]);

    try {
      const res1 = await app.request("/v1/agents/setup-available", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_agent_id: CLAUDE_CODE_ID }),
      });
      const res2 = await app.request("/v1/agents/setup-available", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ default_agent_id: CLAUDE_CODE_ID }),
      });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.length).toBe(body2.length);
      expect(body1.map((agent: { agent_id: string }) => agent.agent_id).sort()).toEqual([CLAUDE_CODE_ID, OPENCODE_ID]);
      expect(body2.map((agent: { agent_id: string }) => agent.agent_id).sort()).toEqual([CLAUDE_CODE_ID, OPENCODE_ID]);
    } finally {
      await close();
    }
  });
});
