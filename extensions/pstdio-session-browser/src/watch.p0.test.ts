import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { nativeSubmissionIndex } from "./native-submission";
import { watchConversation } from "./watch";

const session = {
  id: "s",
  title: "Session",
  status: "completed" as const,
  archived: false,
  agent: "agent",
  cwd: null,
  lastSelectedModel: "A",
  workspaceId: null,
  originalSessionId: null,
  createdAt: "",
  updatedAt: "",
  lastRequestStarted: null,
  lastRequestEnded: null,
  usage: null,
  last_selected_model: "A",
  workspace_id: null,
  original_session_id: null,
  created_at: "",
  updated_at: "",
  last_request_started: null,
  last_request_ended: null,
  anchors_json: [],
  projectId: "p",
  agentSessionId: "native",
  sessionFileId: null,
  params: {},
};

test("an idle or ended native stream retains view resources until disposal without stopping execution", async () => {
  const controller = new AbortController();
  const ended = Promise.withResolvers<void>();
  let closed = 0;
  let stopped = 0;
  let done = false;
  const events: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (event) => {
          events.push(event);
        },
      },
      sessions: {
        get: async () => session,
        getConversation: async () => ({ session, messages: [] }),
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
        }),
        getExecutionState: async () => ({ kind: "local", available: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({
          close: () => {
            closed++;
          },
        }),
        stop: async () => {
          stopped++;
        },
        stream: async (_id, onEvent) => {
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [] } });
          await onEvent({ event: "end", data: { status: "completed" } });
          ended.resolve();
        },
      },
    },
  });
  const watching = watchConversation(ctx, { type: "session", id: "s" }).finally(() => {
    done = true;
  });
  await ended.promise;
  await Promise.resolve();
  await Promise.resolve();
  expect(done).toBe(false);
  expect(closed).toBe(0);
  controller.abort();
  await watching;
  expect(closed).toBe(1);
  expect(stopped).toBe(0);
  expect(events.length).toBeGreaterThan(0);
});

test("a closed presentation channel releases retained resources when publishing fails", async () => {
  let closed = 0;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      stream: {
        write: async () => {
          throw new Error("Presentation closed");
        },
      },
      sessions: {
        get: async () => session,
        getExecutionState: async () => ({ kind: "local", available: true }),
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
        }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({
          close: () => {
            closed++;
          },
        }),
      },
    },
  });
  await expect(watchConversation(ctx, { type: "session", id: "s" })).rejects.toThrow("Presentation closed");
  expect(closed).toBe(1);
});

test("a native watch hands off failed input through recovery events without consuming it before durable save", async () => {
  const { saveNativeSubmission, readNativeSubmissions } = await import("./native-submission");
  const controller = new AbortController();
  const events: unknown[] = [];
  let closed = 0;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (event) => {
          events.push(event);
          if (event && typeof event === "object" && "recoverDraft" in event) controller.abort();
        },
      },
      sessions: {
        get: async () => ({ ...session, status: "failed", lastRequestStarted: "new-run" }),
        getExecutionState: async () => ({ kind: "local", available: true }),
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
        }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        retainResources: async () => ({
          close: () => {
            closed++;
          },
        }),
        stream: async () => {
          controller.abort();
        },
      },
    },
  });
  const draft = { text: "Native objective", attachments: [], values: { harness: { harnessId: "agent", model: "B" } } };
  await saveNativeSubmission(
    ctx,
    "s",
    { draft, operation: { kind: "command", text: "/goal Native objective" } },
    "before",
    true,
  );
  await watchConversation(ctx, { type: "session", id: "s" });
  expect(events).toContainEqual({ revision: 1, recoverDraft: draft });
  expect(await readNativeSubmissions(ctx, "s", true)).toHaveLength(1);
  expect(closed).toBe(1);
});

test("live reply patches keep 67 unchanged 4KiB history messages in the native owner", async () => {
  const controller = new AbortController();
  const frames: import("@pstdio/sdk/extensions").ChatRendererEvent[] = [];
  const messages: import("@pstdio/sdk/extensions").SessionMessage[] = Array.from({ length: 67 }, (_, i) => ({
    id: `history-${i}`,
    role: i % 2 ? "assistant" : "user",
    parts: [{ type: "text", text: "x".repeat(4096) }],
  }));
  messages.push({ id: "live", role: "assistant", parts: [{ type: "text", text: "one" }] });
  const patch = {
    op: "replace" as const,
    path: "/messages/67",
    value: { ...messages[67]!, parts: [{ type: "text" as const, text: "two" }] },
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (event) => {
          frames.push(event as never);
        },
      },
      sessions: {
        get: async () => session,
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
        }),
        getExecutionState: async () => ({ kind: "local", available: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({ close: () => {} }),
        stream: async (_id, onEvent) => {
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: messages } });
          await onEvent({ event: "patch", data: patch });
          controller.abort();
        },
      },
    },
  });
  await watchConversation(ctx, { type: "session", id: "s" });
  const transcript = frames.filter((event) => "patch" in event || ("snapshot" in event && event.snapshot.messages));
  expect(transcript).toHaveLength(2);
  expect(transcript[0]).toMatchObject({ snapshot: { messages } });
  const last = transcript.at(-1)!;
  console.log(
    JSON.stringify({ inputPatchBytes: JSON.stringify(patch).length, outputUpdateBytes: JSON.stringify(last).length }),
  );
  expect(last).toMatchObject({ patch });
  expect(JSON.stringify(last)).not.toContain("history-0");
  expect(frames.map((event) => event.revision)).toEqual(frames.map((_, index) => index));
});

test("steering projection falls back for canonical acknowledgment and reorder, then resumes live patches", async () => {
  const controller = new AbortController();
  const frames: import("@pstdio/sdk/extensions").ChatRendererEvent[] = [];
  const answer = { id: "answer", role: "assistant" as const, parts: [{ type: "text" as const, text: "answer" }] };
  const file = { type: "file" as const, fileId: "file", filename: "context.txt", url: "/file" };
  const delivery = { id: "delivery", role: "user" as const, parts: [{ type: "text" as const, text: "next" }, file] };
  const queue = {
    activeRunStartedAt: "run",
    steeringAvailable: true,
    steeringUnavailableReason: null,
    requests: [
      {
        queuePosition: 1,
        revision: "r1",
        prompt: "next",
        model: "B",
        params: { effort: "high" },
        attachments: [{ file_id: "file" }],
        steeringDelivery: { id: "delivery", runStartedAt: "run" },
      },
    ],
  };
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (event) => {
          frames.push(event as never);
        },
      },
      sessions: {
        get: async () => session,
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
        }),
        getExecutionState: async () => ({ kind: "local", available: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({ close: () => {} }),
        stream: async (_id, onEvent) => {
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [answer] } });
          await onEvent({
            event: "queued_messages",
            data: { queue, messages: [{ ...delivery, id: "queued-prompt-s-1" }] },
          });
          await onEvent({ event: "patch", data: { op: "add", path: "/messages/1", value: delivery } });
          await onEvent({
            event: "patch",
            data: { op: "replace", path: "/messages/1", value: { ...delivery, createdAt: "ack" } },
          });
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [delivery, answer] } });
          await onEvent({
            event: "patch",
            data: { op: "replace", path: "/messages/0", value: { ...delivery, createdAt: "later" } },
          });
          controller.abort();
        },
      },
    },
  });
  await watchConversation(ctx, { type: "session", id: "s" });
  const updates = frames.filter((event) => "patch" in event || ("snapshot" in event && event.snapshot.messages));
  expect(updates).toHaveLength(6);
  expect(updates[1]).toMatchObject({ snapshot: { messages: [answer, delivery], queuedFollowUps: [] } });
  expect(updates[2]).toMatchObject({ snapshot: { messages: [answer, delivery] } });
  expect(updates[3]).toMatchObject({ patch: { path: "/messages/1", value: { ...delivery, createdAt: "ack" } } });
  expect(updates[4]).toMatchObject({ snapshot: { messages: [delivery, answer] } });
  expect(updates[5]).toMatchObject({ patch: { path: "/messages/0", value: { ...delivery, createdAt: "later" } } });
  expect(frames.map((event) => event.revision)).toEqual(frames.map((_, index) => index));
});
