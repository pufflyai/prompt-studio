import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HarnessExit, JsonPatch } from "pstdio-api-contracts";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const FAKE_ID = testHarnessId("fake");

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

  const readUntil = async (predicate: (event: SSEEvent) => boolean, timeoutMs = 5_000) => {
    const events: SSEEvent[] = [];
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed = parseSSEBlock(block);
        if (!parsed) continue;
        events.push(parsed);
        if (predicate(parsed)) return events;
      }
    }

    return events;
  };

  return { readUntil, close: () => reader.cancel() };
};

const createSpyRecord = (): { record: RuntimeHarnessRecord; firstExit: () => void } => {
  const firstExitDeferred = Promise.withResolvers<HarnessExit>();

  const record = createTestHarnessRecord("fake", {
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
        return {
          agentSessionId: `spy-${crypto.randomUUID()}`,
          done: firstExitDeferred.promise,
          stop: () => {},
        };
      },
      resume: (_ctx, input) => {
        input.events.push({
          op: "add",
          path: "/messages/0",
          value: { id: "m3", role: "user", parts: [{ type: "text", text: "SECOND" }] },
        });
        input.events.push({
          op: "add",
          path: "/messages/1",
          value: { id: "m4", role: "assistant", parts: [{ type: "text", text: "SECOND DONE" }] },
        });
        return {
          agentSessionId: input.agentSessionId,
          done: new Promise<HarnessExit>(() => {}),
          stop: () => {},
        };
      },
      getMessages: () => [],
    },
  });

  return {
    record,
    firstExit: () => firstExitDeferred.resolve({ status: "completed" }),
  };
};

const getPatchTextParts = (patch: JsonPatch) => {
  if (!Array.isArray(patch.value)) return [];
  return patch.value.flatMap((message) => {
    if (!message || typeof message !== "object") return [];
    const parts = (message as { parts?: Array<{ type?: string; text?: string }> }).parts;
    if (!Array.isArray(parts)) return [];
    return parts.filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text!);
  });
};

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;
let firstExit: () => void;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-followup-loop-"));
  const spy = createSpyRecord();
  firstExit = spy.firstExit;
  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    harnessRegistry: createTestHarnessRegistry([spy.record]),
  }));
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/sessions/:id/stream follow-up resume continuity", () => {
  test("picks up the dispatched follow-up's events without requiring a reconnect", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Resume Continuity Project" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "Resume Continuity", prompt: "hello", agent: FAKE_ID }),
    });
    const session = await createRes.json();

    // Queue a follow-up while the first run is still active.
    const followUpRes = await app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "follow up" }),
    });
    expect(followUpRes.status).toBe(200);
    expect((await followUpRes.json()).follow_up.status).toBe("queued");

    const streamRes = await app.request(`/v1/sessions/${session.id}/stream`);
    expect(streamRes.status).toBe(200);
    const sse = createSSEReader(streamRes);

    // Read the initial snapshot from the first agent.
    const initial = await sse.readUntil(
      (event) => event.event === "patch" && getPatchTextParts(event.data as JsonPatch).includes("FIRST DONE"),
    );
    const firstSnapshot = initial.find((e) => e.event === "patch")?.data as JsonPatch | undefined;
    expect(firstSnapshot && getPatchTextParts(firstSnapshot)).toContain("FIRST");

    // Now release the first session; the follow-up auto-dispatches inside transitionStatus.
    firstExit();

    // The stream should pick up the new eventStore's snapshot, which contains SECOND DONE.
    const resumed = await sse.readUntil(
      (event) => event.event === "patch" && getPatchTextParts(event.data as JsonPatch).includes("SECOND DONE"),
    );
    const lastPatch = resumed[resumed.length - 1]?.data as JsonPatch | undefined;
    expect(lastPatch && getPatchTextParts(lastPatch)).toContain("SECOND DONE");

    sse.close();
  });
});
