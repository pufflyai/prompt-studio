import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { applyConversationPatch, type HarnessExit, type JsonPatch, type SessionMessage } from "pstdio-api-contracts";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { openSessionStream } from "../../../test-utils/session-stream";
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

const message = (id: string, role: "user" | "assistant", text: string) => ({
  id,
  role,
  parts: [{ type: "text" as const, text }],
});

const firstRunMessages: SessionMessage[] = [
  message("m1", "user", "FIRST"),
  message("m2", "assistant", "FIRST DONE"),
  { id: "usage-1", role: "system", parts: [{ type: "token_usage", inputTokens: 10, outputTokens: 2 }] },
];
const followUpMessages = [message("m3", "user", "SECOND"), message("m4", "assistant", "SECOND DONE")];

const createDelayedResumeRecord = (input: {
  readyForFollowUp: Promise<void>;
  done: Promise<HarnessExit>;
}): RuntimeHarnessRecord =>
  createTestHarnessRecord("fake", {
    provider: {
      start: (_ctx, startInput) => {
        firstRunMessages.forEach((value, index) => {
          startInput.events.push({ op: "add", path: `/messages/${index}`, value });
        });
        return {
          agentSessionId: `delayed-${crypto.randomUUID()}`,
          done: Promise.resolve({ status: "completed" }),
          stop: () => {},
        };
      },
      resume: (_ctx, resumeInput) => {
        void input.readyForFollowUp.then(() => {
          followUpMessages.forEach((value, index) => {
            resumeInput.events.push({
              op: "add",
              path: `/messages/${(resumeInput.messageOffset ?? 0) + index}`,
              value,
            });
          });
        });
        return { agentSessionId: resumeInput.agentSessionId, done: input.done, stop: () => {} };
      },
      // Transcript normalization omits the persisted token-usage message.
      getMessages: () => firstRunMessages.slice(0, 2),
    },
  });

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
  ({ app, close } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([spy.record]),
  }));
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("session stream follow-up resume continuity", () => {
  test("picks up the dispatched follow-up's events without requiring a reconnect", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Resume Continuity Project" })),
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

    const streamRes = await openSessionStream(app, session.id);
    expect(streamRes.status).toBe(200);
    const sse = createSSEReader(streamRes);

    // Read the initial snapshot from the first agent.
    const initial = await sse.readUntil(
      (event) => event.event === "patch" && getPatchTextParts(event.data as JsonPatch).includes("FIRST DONE"),
    );
    // Launch can still be waiting for workspace files when the stream first publishes an empty snapshot.
    const firstSnapshot = initial.at(-1)?.data as JsonPatch | undefined;
    expect(firstSnapshot && getPatchTextParts(firstSnapshot)).toEqual(["FIRST", "FIRST DONE"]);

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

  test("uses the complete baseline offset when live replay is initially empty", async () => {
    const delayedRoot = mkdtempSync(join(tmpdir(), "pstdio-api-stream-delayed-offset-"));
    const readyForFollowUp = Promise.withResolvers<void>();
    const exit = Promise.withResolvers<HarnessExit>();
    const delayedApp = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(delayedRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([
        createDelayedResumeRecord({ readyForFollowUp: readyForFollowUp.promise, done: exit.promise }),
      ]),
    });
    let sse: ReturnType<typeof createSSEReader> | undefined;

    try {
      const projectRes = await delayedApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Delayed Offset Project" })),
      });
      const project = await projectRes.json();

      const createRes = await delayedApp.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Delayed Offset", prompt: "hello", agent: FAKE_ID }),
      });
      const session = await createRes.json();

      for (let attempt = 0; attempt < 50; attempt += 1) {
        const response = await delayedApp.app.request(`/v1/sessions/${session.id}`);
        if ((await response.json()).status === "completed") break;
        await Bun.sleep(10);
      }

      const followUpRes = await delayedApp.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "follow up" }),
      });
      expect(followUpRes.status).toBe(200);

      sse = createSSEReader(await openSessionStream(delayedApp.app, session.id));
      const initial = await sse.readUntil(
        (event) => event.event === "patch" && (event.data as JsonPatch).path === "/approval_requests",
      );
      const snapshot = initial.find((event) => event.event === "patch")?.data as JsonPatch;
      expect(snapshot).toEqual({ op: "replace", path: "/messages", value: firstRunMessages });
      expect(initial.at(-1)?.data).toEqual({ op: "replace", path: "/approval_requests", value: [] });

      // The follow-up's output starts only after the client holds the initial snapshot.
      readyForFollowUp.resolve();
      const expected = [...firstRunMessages, ...followUpMessages];
      const states: SessionMessage[][] = [];
      let conversation = firstRunMessages;
      await sse.readUntil((event) => {
        if (event.event !== "patch") return false;
        conversation = applyConversationPatch([...conversation], event.data as JsonPatch);
        states.push(conversation);
        return conversation.length >= expected.length;
      });

      // A stream that is still sending when output arrives coalesces it into one current
      // `/messages` snapshot instead of indexed patches. Either form must extend the
      // complete baseline, so the follow-up lands after the token-usage message.
      for (const state of states) {
        expect(state.length).toBeGreaterThanOrEqual(firstRunMessages.length);
        expect(state).toEqual(expected.slice(0, state.length));
      }
      expect(conversation).toEqual(expected);
    } finally {
      readyForFollowUp.resolve();
      exit.resolve({ status: "completed" });
      try {
        await sse?.close();
      } finally {
        await delayedApp.close();
        rmSync(delayedRoot, { recursive: true, force: true });
      }
    }
  });
});
