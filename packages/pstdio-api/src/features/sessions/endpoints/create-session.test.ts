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
