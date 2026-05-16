import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
const previousAgentsEnv = process.env.PSTDIO_AGENTS;

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const getRes = await app.request(`/v1/sessions/${sessionId}`);
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(20);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-session-test-"));
  process.env.PSTDIO_AGENTS = "fake";
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));
});

afterAll(() => {
  if (previousAgentsEnv === undefined) {
    delete process.env.PSTDIO_AGENTS;
  } else {
    process.env.PSTDIO_AGENTS = previousAgentsEnv;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions", () => {
  test("returns 400 when agent is omitted and no default agent is configured", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Missing Default Agent Project" }),
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
      }),
    });

    expect(createRes.status).toBe(400);
    expect(await createRes.json()).toEqual({
      error: "No agent configured. Set a default agent with 'pstdio agents setup' first.",
    });
  });

  test("uses the configured default agent when agent is omitted", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Default Agent Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const setupAgentRes = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "fake" }),
    });
    expect(setupAgentRes.status).toBe(201);

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Default fake session",
        prompt: "run fake flow",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const session = await waitForSessionStatus(created.id, "completed");
    expect(session.agent).toBe("fake");
  });

  test("persists explicit model as the last selected model for dashboard-created sessions", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Explicit Model Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Explicit model session",
        prompt: "run fake flow",
        agent: "fake",
        model: "fake-model",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.last_selected_model).toBe("fake-model");

    const session = await waitForSessionStatus(created.id, "completed");
    expect(session.last_selected_model).toBe("fake-model");
  });

  test("returns 400 when requested agent is not enabled for the project", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project Scoped Agent", agents: ["opencode"] }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Scoped Agent Session",
        prompt: "Run task",
        agent: "fake",
      }),
    });

    expect(createRes.status).toBe(400);
    expect(await createRes.json()).toEqual({ error: "Agent 'fake' is not enabled for this project." });
  });

  test("uses the project default agent when set and overrides the global default", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project Default Agent" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const setupGlobalDefault = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "opencode" }),
    });
    expect(setupGlobalDefault.status).toBe(201);

    const setupFake = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "fake" }),
    });
    expect(setupFake.status).toBe(201);

    const patchRes = await app.request(`/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ default_agent_id: "fake" }),
    });
    expect(patchRes.status).toBe(200);

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Project default agent session",
        prompt: "run fake flow",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const session = await waitForSessionStatus(created.id, "completed");
    expect(session.agent).toBe("fake");
  });

  test("uses the project's enabled agent when global default is outside project selection", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Project Enabled Agent", agents: ["fake"] }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const setupDefaultRes = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "opencode" }),
    });
    expect(setupDefaultRes.status).toBe(201);

    const setupEnabledRes = await app.request("/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_id: "fake" }),
    });
    expect(setupEnabledRes.status).toBe(201);

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Project enabled agent session",
        prompt: "run fake flow",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const session = await waitForSessionStatus(created.id, "completed");
    expect(session.agent).toBe("fake");
  });

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

describe("POST /v1/sessions - lifecycle", () => {
  test("starts multiple sessions immediately when concurrency setting is unlimited", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Unlimited Session Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const firstRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "First", prompt: "first", agent: "fake" }),
    });
    const secondRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "Second", prompt: "second", agent: "fake" }),
    });

    expect(firstRes.status).toBe(201);
    expect(secondRes.status).toBe(201);
    const first = await firstRes.json();
    const second = await secondRes.json();
    expect(first.status).toBe("in_progress");
    expect(second.status).toBe("in_progress");

    const queuedRes = await app.request(`/v1/sessions?project_id=${project.id}&status=queued`);
    expect(queuedRes.status).toBe(200);
    expect(await queuedRes.json()).toEqual([]);

    await waitForSessionStatus(first.id, "completed");
    await waitForSessionStatus(second.id, "completed");
  });

  test("completes sessions and persists messages when fake agent is enabled", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Fake Agent Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Fake agent session",
        prompt: "run fake flow",
        agent: "fake",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const session = await waitForSessionStatus(created.id, "completed");
    expect(session.agent_session_id).not.toBeNull();
    expect(session.session_file_id).not.toBeNull();

    const activityRes = await app.request(`/v1/sessions/${created.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string; resource_id: string }>;
    };
    expect(activity.events[0]).toMatchObject({ event_type: "session_created", resource_id: created.id });
  });

  test("replays fake agent patches over session stream", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Fake Stream Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Stream fake session",
        prompt: "stream me",
        agent: "fake",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    await waitForSessionStatus(created.id, "completed");

    const streamRes = await app.request(`/v1/sessions/${created.id}/stream`);
    expect(streamRes.status).toBe(200);
    const body = await streamRes.text();

    expect(body).toContain("event: ready");
    expect(body).toContain("event: patch");
    expect(body).toContain("event: end");
    expect(body).toContain('"status":"completed"');
    expect(body).toContain("Fake Agent");
  });

  test("stores resolved cwd on session record at creation time", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CWD Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "CWD session",
        prompt: "check cwd",
        agent: "fake",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    await waitForSessionStatus(created.id, "completed");

    const getRes = await app.request(`/v1/sessions/${created.id}`);
    const session = await getRes.json();
    // No repo linked so cwd is null, but the field exists on the record
    expect(session).toHaveProperty("cwd");
  });

  test("runs follow-up through fake resume flow and persists appended messages", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Fake Follow-up Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Follow-up fake session",
        prompt: "first prompt",
        agent: "fake",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    await waitForSessionStatus(created.id, "completed");

    const followUpRes = await app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "second prompt" }),
    });
    expect(followUpRes.status).toBe(200);

    await waitForSessionStatus(created.id, "completed");

    const streamRes = await app.request(`/v1/sessions/${created.id}/stream`);
    expect(streamRes.status).toBe(200);
    const body = await streamRes.text();

    expect(body).toContain("first prompt");
    expect(body).toContain("second prompt");
    expect(body).toContain("Fake Agent: follow-up");
  });
});
