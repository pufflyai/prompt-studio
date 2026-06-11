import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HarnessExit, HarnessSession, JsonPatch, SessionMessage } from "pstdio-api-contracts";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createApp } from "../../../app";
import { waitForSyncEvent } from "../../../test-utils/wait-for-sync-event";
import type { AppBindings } from "../../../types";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import type { EventBus } from "../../sync/event-bus";

const FAKE_ID = testHarnessId("fake");

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let close: () => Promise<void>;
let eventBus: EventBus;

const delayedExit = (exitDelayMs: number): HarnessSession => ({
  agentSessionId: `fake-${crypto.randomUUID()}`,
  done: new Promise<HarnessExit>((resolve) => {
    setTimeout(() => resolve({ status: "completed" }), exitDelayMs);
  }),
  stop: () => {},
});

// Mirrors the canonical fake harness: pushes a user + assistant message then completes shortly after.
const createFakeHarnessRecord = (): RuntimeHarnessRecord => {
  const sessions = new Map<string, SessionMessage[]>();

  const message = (agentSessionId: string, index: number, role: SessionMessage["role"], text: string) => ({
    id: `${agentSessionId}-msg-${index}`,
    role,
    parts: [{ type: "text" as const, text }],
  });

  return createTestHarnessRecord("fake", {
    provider: {
      start: (_ctx, input) => {
        const session = delayedExit(50);
        const agentSessionId = session.agentSessionId!;
        const messages = [
          message(agentSessionId, 0, "user", input.prompt),
          message(agentSessionId, 1, "assistant", `Fake Agent: completed "${input.prompt}"`),
        ];
        sessions.set(agentSessionId, messages);
        for (const [index, value] of messages.entries()) {
          input.events.push({ op: "add", path: `/messages/${index}`, value });
        }
        return session;
      },
      resume: (_ctx, input) => {
        const existing = sessions.get(input.agentSessionId) ?? [];
        const startIndex = input.messageOffset ?? existing.length;
        const messages = [
          message(input.agentSessionId, startIndex, "user", input.prompt),
          message(input.agentSessionId, startIndex + 1, "assistant", `Fake Agent: follow-up "${input.prompt}"`),
        ];
        sessions.set(input.agentSessionId, [...existing, ...messages]);
        for (const [offset, value] of messages.entries()) {
          input.events.push({ op: "add", path: `/messages/${startIndex + offset}`, value });
        }
        return { ...delayedExit(50), agentSessionId: input.agentSessionId };
      },
      getMessages: (_ctx, input) => sessions.get(input.agentSessionId) ?? [],
    },
  });
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-test-"));

  ({ app, close, eventBus } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    harnessRegistry: createTestHarnessRegistry([createFakeHarnessRecord()]),
  }));
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

const waitForSessionStatus = (bus: EventBus, sessionId: string, expectedStatus: string) =>
  waitForSyncEvent(
    bus,
    (event) =>
      event.table === "sessions" &&
      event.op === "set" &&
      (event.data as { id: string; status: string }).id === sessionId &&
      (event.data as { id: string; status: string }).status === expectedStatus,
    2_500,
  );

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

const createSlowFakeRecord = (exitDelayMs: number) =>
  createTestHarnessRecord("fake", {
    provider: {
      start: () => delayedExit(exitDelayMs),
      resume: (_ctx, input) => ({ ...delayedExit(exitDelayMs), agentSessionId: input.agentSessionId }),
      getMessages: () => [],
    },
  });

const createHistoryReplayRecord = (input: {
  initialPatches: JsonPatch[];
  livePatch: JsonPatch;
  liveDelayMs: number;
  exitDelayMs: number;
}) =>
  createTestHarnessRecord("fake", {
    provider: {
      start: (_ctx, startInput) => {
        for (const patch of input.initialPatches) {
          startInput.events.push(patch);
        }

        setTimeout(() => {
          startInput.events.push(input.livePatch);
        }, input.liveDelayMs);

        return { ...delayedExit(input.exitDelayMs), agentSessionId: `history-${crypto.randomUUID()}` };
      },
      resume: (_ctx, resumeInput) => ({
        ...delayedExit(input.exitDelayMs),
        agentSessionId: resumeInput.agentSessionId,
      }),
      getMessages: () => [],
    },
  });

const createResumeOverlapRecord = () =>
  createTestHarnessRecord("fake", {
    provider: {
      start: (_ctx, input) => {
        input.events.push({
          op: "add",
          path: "/messages/0",
          value: { id: "m1", role: "user", parts: [{ type: "text", text: "FIRST" }] },
        });
        input.events.push({
          op: "add",
          path: "/messages/1",
          value: { id: "m2", role: "assistant", parts: [{ type: "text", text: "FIRST DONE" }] },
        });

        return { ...delayedExit(50), agentSessionId: `resume-overlap-${crypto.randomUUID()}` };
      },
      resume: (_ctx, input) => {
        input.events.push({
          op: "add",
          path: "/messages/0",
          value: { id: "m3", role: "user", parts: [{ type: "text", text: "SECOND" }] },
        });

        setTimeout(() => {
          input.events.push({
            op: "add",
            path: "/messages/1",
            value: { id: "m4", role: "assistant", parts: [{ type: "text", text: "SECOND DONE" }] },
          });
        }, 50);

        return { ...delayedExit(300), agentSessionId: input.agentSessionId };
      },
      getMessages: () => {
        throw new Error("message lookup failed");
      },
    },
  });

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
        agent: FAKE_ID,
      }),
    });
    expect(createRes.status).toBe(201);
    const session = await createRes.json();

    await waitForSessionStatus(eventBus, session.id, "completed");

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
        agent: FAKE_ID,
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(eventBus, session.id, "completed");

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
    const {
      app: heartbeatApp,
      close: closeHeartbeatApp,
      eventBus: heartbeatEventBus,
    } = await createApp({
      dbPath: ":memory:",
      storagePath: join(heartbeatRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createTestHarnessRegistry([createSlowFakeRecord(1200)]),
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
        agent: FAKE_ID,
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

    await expect(waitForSessionStatus(heartbeatEventBus, session.id, "completed")).resolves.toBeDefined();

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

    const {
      app: replayApp,
      close: closeReplayApp,
      eventBus: replayEventBus,
    } = await createApp({
      dbPath: ":memory:",
      storagePath: join(replayRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createTestHarnessRegistry([
        createHistoryReplayRecord({
          initialPatches,
          livePatch: {
            op: "add",
            path: "/messages/2",
            value: { id: "m3", role: "assistant", parts: [{ type: "text", text: "LIVE" }] },
          },
          liveDelayMs: 50,
          exitDelayMs: 300,
        }),
      ]),
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
        agent: FAKE_ID,
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

    await expect(waitForSessionStatus(replayEventBus, session.id, "completed")).resolves.toBeDefined();

    await closeReplayApp();
    rmSync(replayRoot, { recursive: true, force: true });
  });

  test("shifts overlapping live indexed patches after the initial snapshot", async () => {
    const overlapRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-overlap-test-"));
    const {
      app: overlapApp,
      close: closeOverlapApp,
      eventBus: overlapEventBus,
    } = await createApp({
      dbPath: ":memory:",
      storagePath: join(overlapRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createTestHarnessRegistry([createResumeOverlapRecord()]),
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
        agent: FAKE_ID,
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(overlapEventBus, session.id, "completed");

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

    // Let the resumed run settle before closing so its exit handling doesn't hit a closed db.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const res = await overlapApp.request(`/v1/sessions/${session.id}`);
      if ((await res.json()).status === "completed") break;
      await Bun.sleep(25);
    }

    await closeOverlapApp();
    rmSync(overlapRoot, { recursive: true, force: true });
  });
});
