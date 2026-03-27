import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AgentService, SessionMessageInput, SessionStartInput } from "pstdio-agents";
import { createFakeAgent } from "pstdio-agents";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let close: () => Promise<void>;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-test-"));

  const fakeAgent = createFakeAgent();

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    agents: [fakeAgent],
  }));
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    const body = await res.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(50);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

interface SSEEvent {
  event: string;
  data: unknown;
}

const parseSSEBlock = (block: string): SSEEvent | null => {
  if (!block.trim()) return null;

  let event = "message";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data = line.slice(5).trim();
  }

  return data ? { event, data: JSON.parse(data) } : null;
};

const createSSEReader = (response: Response) => {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const readEvents = async (count: number) => {
    const events: SSEEvent[] = [];

    while (events.length < count) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (parsed) events.push(parsed);
      }
    }

    return events;
  };

  const close = () => reader.cancel();

  return { readEvents, close };
};

const createSlowFakeAgent = (exitDelayMs: number): AgentService => {
  const createProcess = (sessionId: string) => ({
    sessionId,
    stdin: new PassThrough(),
    kill: () => {},
    onExit: new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      setTimeout(() => resolve({ code: 0, signal: null }), exitDelayMs);
    }),
  });

  const startSession = async (_input: SessionStartInput) => {
    const sessionId = `slow-${crypto.randomUUID()}`;
    return { sessionId, process: createProcess(sessionId) };
  };

  const resumeSession = async (input: SessionMessageInput) => ({ process: createProcess(input.sessionId) });

  return {
    id: "fake",
    name: "Slow Fake Agent",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [],
    startSession,
    resumeSession,
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async (sessionId) => ({
      session: {
        id: sessionId,
        title: "Slow Fake Session",
        directory: process.cwd(),
        updatedAt: new Date().toISOString(),
      },
      messages: [],
    }),
    launchSession: async () => ({}),
  };
};

describe("GET /v1/sessions/:id/stream", () => {
  test("sends end event with the current DB status", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Stream Test Project" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Completed session",
        prompt: "hello",
        agent: "fake",
      }),
    });
    expect(createRes.status).toBe(201);
    const session = await createRes.json();

    await waitForSessionStatus(session.id, "completed");

    const streamRes = await app.request(`/v1/sessions/${session.id}/stream`);
    expect(streamRes.status).toBe(200);
    const body = await streamRes.text();

    expect(body).toContain('"status":"completed"');
  });

  test("does not alter failed or cancelled status", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Failed Session Test" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Will be marked failed",
        prompt: "hello",
        agent: "fake",
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(session.id, "completed");

    // Force to failed
    await app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });

    const streamRes = await app.request(`/v1/sessions/${session.id}/stream`);
    const body = await streamRes.text();
    expect(body).toContain('"status":"failed"');
  });

  test("emits heartbeat events while session is in progress", async () => {
    const heartbeatRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-heartbeat-test-"));
    const { app: heartbeatApp, close: closeHeartbeatApp } = await createApp({
      dbPath: ":memory:",
      storagePath: join(heartbeatRoot, "storage"),
      agents: [createSlowFakeAgent(1200)],
    });

    const projectRes = await heartbeatApp.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Heartbeat Session Project" }),
    });
    const project = await projectRes.json();

    const createRes = await heartbeatApp.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Slow stream session",
        prompt: "wait for heartbeat",
        agent: "fake",
      }),
    });
    const session = await createRes.json();

    const streamRes = await heartbeatApp.request(`/v1/sessions/${session.id}/stream`);
    expect(streamRes.status).toBe(200);

    const sse = createSSEReader(streamRes);
    const events = await sse.readEvents(2);
    sse.close();

    expect(events.map((event) => event.event)).toContain("ready");
    expect(events.map((event) => event.event)).toContain("heartbeat");

    let finished = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const res = await heartbeatApp.request(`/v1/sessions/${session.id}`);
      const body = await res.json();
      if (body.status === "completed") {
        finished = true;
        break;
      }
      await Bun.sleep(50);
    }
    expect(finished).toBe(true);

    await closeHeartbeatApp();
    rmSync(heartbeatRoot, { recursive: true, force: true });
  });
});
