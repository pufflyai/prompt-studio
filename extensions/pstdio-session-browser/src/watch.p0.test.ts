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
