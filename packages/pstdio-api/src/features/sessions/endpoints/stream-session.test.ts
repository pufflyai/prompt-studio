import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AgentService, EventStore, JsonPatch, SessionMessageInput, SessionStartInput } from "pstdio-agents";
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

const createHistoryReplayAgent = (input: {
  initialPatches: JsonPatch[];
  livePatch: JsonPatch;
  liveDelayMs: number;
  exitDelayMs: number;
}): AgentService => {
  const createProcess = (sessionId: string) => ({
    sessionId,
    stdin: new PassThrough(),
    kill: () => {},
    onExit: new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      setTimeout(() => resolve({ code: 0, signal: null }), input.exitDelayMs);
    }),
  });

  const startSession = async (sessionInput: SessionStartInput) => {
    const sessionId = `history-${crypto.randomUUID()}`;

    for (const patch of input.initialPatches) {
      sessionInput.eventStore?.push(patch);
    }

    setTimeout(() => {
      sessionInput.eventStore?.push(input.livePatch);
    }, input.liveDelayMs);

    return { sessionId, process: createProcess(sessionId) };
  };

  const resumeSession = async (sessionInput: SessionMessageInput) => ({
    process: createProcess(sessionInput.sessionId),
  });

  return {
    id: "fake",
    name: "History Replay Agent",
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
        title: "History Replay Session",
        directory: process.cwd(),
        updatedAt: new Date().toISOString(),
      },
      messages: [],
    }),
    launchSession: async () => ({}),
  };
};

const createResumeOverlapAgent = (): AgentService => {
  const createProcess = (sessionId: string, exitDelayMs: number) => ({
    sessionId,
    stdin: new PassThrough(),
    kill: () => {},
    onExit: new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      setTimeout(() => resolve({ code: 0, signal: null }), exitDelayMs);
    }),
  });

  const startSession = async (input: SessionStartInput) => {
    const sessionId = `resume-overlap-${crypto.randomUUID()}`;

    input.eventStore?.push({
      op: "add",
      path: "/messages/0",
      value: { id: "m1", role: "user", parts: [{ type: "text", text: "FIRST" }] },
    });
    input.eventStore?.push({
      op: "add",
      path: "/messages/1",
      value: { id: "m2", role: "assistant", parts: [{ type: "text", text: "FIRST DONE" }] },
    });

    return { sessionId, process: createProcess(sessionId, 50) };
  };

  const resumeSession = async (input: SessionMessageInput, eventStore: EventStore) => {
    eventStore.push({
      op: "add",
      path: "/messages/0",
      value: { id: "m3", role: "user", parts: [{ type: "text", text: "SECOND" }] },
    });

    setTimeout(() => {
      eventStore.push({
        op: "add",
        path: "/messages/1",
        value: { id: "m4", role: "assistant", parts: [{ type: "text", text: "SECOND DONE" }] },
      });
    }, 50);

    return { process: createProcess(input.sessionId, 300) };
  };

  return {
    id: "fake",
    name: "Resume Overlap Agent",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [],
    startSession,
    resumeSession,
    getMessages: async () => {
      throw new Error("message lookup failed");
    },
    listSessions: async () => [],
    exportSession: async (sessionId) => ({
      session: {
        id: sessionId,
        title: "Resume Overlap Session",
        directory: process.cwd(),
        updatedAt: new Date().toISOString(),
      },
      messages: [],
    }),
    launchSession: async () => ({}),
  };
};

const getPatchTextParts = (patch: JsonPatch) => {
  if (!Array.isArray(patch.value)) {
    return [];
  }

  return patch.value.flatMap((message) => {
    if (!message || typeof message !== "object") {
      return [];
    }

    const parts = (message as { parts?: Array<{ type?: string; text?: string }> }).parts;
    if (!Array.isArray(parts)) {
      return [];
    }

    return parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string);
  });
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

describe("GET /v1/sessions/:id/stream active session replay", () => {
  test("replays active session history as a single snapshot before live patches", async () => {
    const replayRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-history-test-"));
    const initialPatches: JsonPatch[] = [
      {
        op: "add",
        path: "/messages/0",
        value: { id: "m1", role: "user", parts: [{ type: "text", text: "FIRST" }] },
      },
      {
        op: "add",
        path: "/messages/1",
        value: { id: "m2", role: "assistant", parts: [{ type: "text", text: "DONE" }] },
      },
    ];

    const { app: replayApp, close: closeReplayApp } = await createApp({
      dbPath: ":memory:",
      storagePath: join(replayRoot, "storage"),
      agents: [
        createHistoryReplayAgent({
          initialPatches,
          livePatch: {
            op: "add",
            path: "/messages/2",
            value: { id: "m3", role: "assistant", parts: [{ type: "text", text: "LIVE" }] },
          },
          liveDelayMs: 50,
          exitDelayMs: 300,
        }),
      ],
    });

    const projectRes = await replayApp.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "History Replay Project" }),
    });
    const project = await projectRes.json();

    const createRes = await replayApp.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "History replay session",
        prompt: "hello",
        agent: "fake",
      }),
    });
    const session = await createRes.json();

    const streamRes = await replayApp.request(`/v1/sessions/${session.id}/stream`);
    expect(streamRes.status).toBe(200);

    const sse = createSSEReader(streamRes);
    const events = await sse.readEvents(3);
    sse.close();

    expect(events[0]?.event).toBe("ready");

    const snapshotPatch = events[1]?.data as JsonPatch;
    expect(snapshotPatch).toMatchObject({
      op: "replace",
      path: "/messages",
    });
    expect(getPatchTextParts(snapshotPatch)).toEqual(["FIRST", "DONE"]);

    const livePatch = events[2]?.data as JsonPatch;
    expect(livePatch).toMatchObject({
      op: "add",
      path: "/messages/2",
    });

    let completed = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const res = await replayApp.request(`/v1/sessions/${session.id}`);
      const body = await res.json();
      if (body.status === "completed") {
        completed = true;
        break;
      }
      await Bun.sleep(50);
    }
    expect(completed).toBe(true);

    await closeReplayApp();
    rmSync(replayRoot, { recursive: true, force: true });
  });

  test("shifts overlapping live indexed patches after the initial snapshot", async () => {
    const overlapRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-overlap-test-"));
    const { app: overlapApp, close: closeOverlapApp } = await createApp({
      dbPath: ":memory:",
      storagePath: join(overlapRoot, "storage"),
      agents: [createResumeOverlapAgent()],
    });

    const projectRes = await overlapApp.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Overlap Replay Project" }),
    });
    const project = await projectRes.json();

    const createRes = await overlapApp.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Overlap replay session",
        prompt: "hello",
        agent: "fake",
      }),
    });
    const session = await createRes.json();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const statusRes = await overlapApp.request(`/v1/sessions/${session.id}`);
      const statusBody = await statusRes.json();
      if (statusBody.status === "completed") {
        break;
      }
      await Bun.sleep(50);
    }

    const followUpRes = await overlapApp.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "follow up" }),
    });
    expect(followUpRes.status).toBe(200);

    const streamRes = await overlapApp.request(`/v1/sessions/${session.id}/stream`);
    expect(streamRes.status).toBe(200);

    const sse = createSSEReader(streamRes);
    const events = await sse.readEvents(3);
    sse.close();

    expect(events[0]?.event).toBe("ready");

    const snapshotPatch = events[1]?.data as JsonPatch;
    expect(snapshotPatch).toMatchObject({
      op: "replace",
      path: "/messages",
    });
    expect(getPatchTextParts(snapshotPatch)).toEqual(["FIRST", "FIRST DONE", "SECOND"]);

    const livePatch = events[2]?.data as JsonPatch;
    expect(livePatch).toMatchObject({
      op: "add",
      path: "/messages/3",
    });
    expect((livePatch.value as { parts: Array<{ text?: string }> }).parts[0]?.text).toBe("SECOND DONE");

    await closeOverlapApp();
    rmSync(overlapRoot, { recursive: true, force: true });
  });
});
