import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HarnessExit, HarnessSession, SessionMessage } from "pstdio-api-contracts";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const OPENCODE_ID = testHarnessId("opencode");

const message = (role: SessionMessage["role"], text: string): SessionMessage => ({
  id: crypto.randomUUID(),
  role,
  parts: [{ type: "text", text }],
});

const completeAfter = (exitDelayMs: number, agentSessionId: string): HarnessSession => ({
  agentSessionId,
  done: new Promise<HarnessExit>((resolve) => {
    setTimeout(() => resolve({ status: "completed" }), exitDelayMs);
  }),
  stop: () => {},
});

// Mirrors the legacy opencode test agent: records conversation per provider session
// and replays the full history as a `/messages` replace patch on every turn.
const createOpencodeRecord = (options?: { failOnResume?: boolean }): RuntimeHarnessRecord => {
  const sessionMessages = new Map<string, SessionMessage[]>();

  return createTestHarnessRecord("opencode", {
    provider: {
      start: (_ctx, input) => {
        const agentSessionId = `oc-${crypto.randomUUID().slice(0, 8)}`;
        const messages = [message("user", input.prompt), message("assistant", `OpenCode: ${input.prompt}`)];
        sessionMessages.set(agentSessionId, messages);
        input.events.push({ op: "replace", path: "/messages", value: messages });
        return completeAfter(200, agentSessionId);
      },
      resume: (_ctx, input) => {
        if (options?.failOnResume) {
          throw new Error("Internal Server Error");
        }

        const messages = [
          ...(sessionMessages.get(input.agentSessionId) ?? []),
          message("user", input.prompt),
          message("assistant", `OpenCode: ${input.prompt}`),
        ];
        sessionMessages.set(input.agentSessionId, messages);
        input.events.push({ op: "replace", path: "/messages", value: messages });
        return completeAfter(200, input.agentSessionId);
      },
      getMessages: (_ctx, input) => sessionMessages.get(input.agentSessionId) ?? [],
      listModels: () => [],
    },
  });
};

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(50);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

const createProject = async (target: OpenAPIHono<AppBindings>, name: string) => {
  const res = await target.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const createSession = async (
  target: OpenAPIHono<AppBindings>,
  projectId: string,
  input: { title: string; prompt: string; agent?: string; model?: string },
) => {
  const res = await target.request("/v1/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, agent: input.agent ?? OPENCODE_ID, ...input }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-followup-test-"));

  ({ app } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([createOpencodeRecord()]),
  }));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions/:id/follow-up (opencode)", () => {
  test("follow-up transitions through in_progress and completes with new messages", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "OpenCode Follow-up Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    // Create initial session
    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "OpenCode session",
        prompt: "first prompt",
        agent: OPENCODE_ID,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const completedSession = await waitForSessionStatus(created.id, "completed");
    expect(completedSession.agent_session_id).not.toBeNull();

    // Send follow-up
    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "second prompt" }),
    });
    expect(followUpRes.status).toBe(200);
    const followUpBody = await followUpRes.json();
    expect(followUpBody.status).toBe("in_progress");

    // Wait for completion
    await waitForSessionStatus(created.id, "completed");

    // Stream replayed messages and verify both prompts are present
    const streamRes = await app.request(`/v1/sessions/${created.id}/stream`);
    expect(streamRes.status).toBe(200);
    const body = await streamRes.text();

    expect(body).toContain("first prompt");
    expect(body).toContain("second prompt");
    expect(body).toContain("OpenCode: first prompt");
    expect(body).toContain("OpenCode: second prompt");
  });

  test("follow-up updates the session last selected model", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "OpenCode Follow-up Model Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "OpenCode model session",
        prompt: "first prompt",
        agent: OPENCODE_ID,
        model: "openai/gpt-5.5",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await waitForSessionStatus(created.id, "completed");

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "second prompt", model: "openai/gpt-5.3-codex" }),
    });
    expect(followUpRes.status).toBe(200);
    const followUpBody = await followUpRes.json();
    expect(followUpBody.last_selected_model).toBe("openai/gpt-5.3-codex");

    const session = await waitForSessionStatus(created.id, "completed");
    expect(session.last_selected_model).toBe("openai/gpt-5.3-codex");
  });

  test("follow-up from disconnected session is accepted", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Disconnected Follow-up Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Will disconnect",
        prompt: "first prompt",
        agent: OPENCODE_ID,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await waitForSessionStatus(created.id, "completed");

    // Simulate disconnected state (as would happen after server restart)
    await app.request(`/v1/sessions/${created.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "disconnected" }),
    });

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "continue after disconnect" }),
    });
    expect(followUpRes.status).toBe(200);

    const followUpBody = await followUpRes.json();
    expect(followUpBody.status).toBe("in_progress");

    await waitForSessionStatus(created.id, "completed");
  });

  test("follow-up against in_progress session is queued and dispatches after terminal transition", async () => {
    const project = await createProject(app, "In-Progress Queue Project");
    const created = await createSession(app, project.id, { title: "Stays in_progress", prompt: "first prompt" });

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "next thing" }),
    });
    expect(followUpRes.status).toBe(200);
    const followUpBody = await followUpRes.json();
    expect(followUpBody.follow_up.status).toBe("queued");
    expect(typeof followUpBody.follow_up.queue_position).toBe("number");

    await waitForSessionStatus(created.id, "completed");

    const body = await (await app.request(`/v1/sessions/${created.id}/stream`)).text();
    expect(body).toContain("first prompt");
    expect(body).toContain("next thing");
  });

  test("follow-up marks session as failed when opencode harness returns an error", async () => {
    const failTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-followup-fail-"));
    const { app: failApp } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(failTempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([createOpencodeRecord({ failOnResume: true })]),
    });

    const projectRes = await failApp.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Fail Project" }),
    });
    const project = await projectRes.json();

    const createRes = await failApp.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Will fail on follow-up",
        prompt: "initial prompt",
        agent: OPENCODE_ID,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Wait for initial session to complete
    const waitForStatus = async (sessionId: string, status: string) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const res = await failApp.request(`/v1/sessions/${sessionId}`);
        const body = await res.json();
        if (body.status === status) return body;
        await Bun.sleep(50);
      }
      throw new Error(`Session ${sessionId} did not reach ${status}`);
    };

    await waitForStatus(created.id, "completed");

    // Send follow-up that will fail
    const followUpRes = await failApp.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "this will fail" }),
    });
    expect(followUpRes.status).toBe(200);

    // Session should transition to failed
    const failedSession = await waitForStatus(created.id, "failed");
    expect(failedSession.status).toBe("failed");

    rmSync(failTempRoot, { recursive: true, force: true });
  });
});
