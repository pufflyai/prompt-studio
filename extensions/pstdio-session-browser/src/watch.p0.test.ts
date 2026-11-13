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
        get: async () => ({ ...session, status: "failed", lastRequestStarted: "2026-11-06T00:00:00.000Z" }),
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
  const frames: import("@pstdio/sdk/extensions").ChatRendererStreamEvent[] = [];
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
          if (new TextEncoder().encode(JSON.stringify(event)).byteLength > 64 * 1024)
            throw new Error("Command stream chunk exceeds 64 KiB");
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
  // Test-only reconstruction verifies the public wire remains lossless; production
  // uses the native host decoder and never reimplements framing in this extension.
  const events: import("@pstdio/sdk/extensions").ChatRendererEvent[] = [];
  let parts: Uint8Array[] = [];
  for (const frame of frames) {
    if (!("fragment" in frame)) {
      events.push(frame);
      continue;
    }
    parts.push(Uint8Array.from(atob(frame.fragment.data), (char) => char.charCodeAt(0)));
    if (frame.fragment.index === frame.fragment.count - 1) {
      events.push(JSON.parse(Buffer.concat(parts).toString("utf8")));
      parts = [];
    }
  }
  const transcript = events.filter((event) => "patch" in event || ("snapshot" in event && event.snapshot.messages));
  let restored: import("@pstdio/sdk/extensions").SessionMessage[] = [];
  const { applySessionMessagePatch } = await import("@pstdio/sdk/extensions");
  for (const event of transcript.slice(0, -1)) {
    if ("snapshot" in event && event.snapshot.messages) restored = event.snapshot.messages;
    else if ("patch" in event) restored = applySessionMessagePatch(restored, event.patch);
  }
  expect(restored).toEqual(messages);
  const last = transcript.at(-1)!;
  console.log(
    JSON.stringify({ inputPatchBytes: JSON.stringify(patch).length, outputUpdateBytes: JSON.stringify(last).length }),
  );
  expect(last).toMatchObject({ patch });
  expect(JSON.stringify(last)).not.toContain("history-0");
  expect(events.map((event) => event.revision)).toEqual(events.map((_, index) => index));
  expect(frames.every((frame) => Buffer.byteLength(JSON.stringify(frame)) <= 64 * 1024)).toBe(true);
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
            data: { op: "replace", path: "/messages/1", value: { ...delivery, createdAt: 1793923200000 } },
          });
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [delivery, answer] } });
          await onEvent({
            event: "patch",
            data: { op: "replace", path: "/messages/0", value: { ...delivery, createdAt: 1793923201000 } },
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
  expect(updates[3]).toMatchObject({
    patch: { path: "/messages/1", value: { ...delivery, createdAt: 1793923200000 } },
  });
  expect(updates[4]).toMatchObject({ snapshot: { messages: [delivery, answer] } });
  expect(updates[5]).toMatchObject({
    patch: { path: "/messages/0", value: { ...delivery, createdAt: 1793923201000 } },
  });
  expect(frames.map((event) => event.revision)).toEqual(frames.map((_, index) => index));
});

test("an empty queue checkpoint does not replay the accumulated live transcript", async () => {
  const controller = new AbortController();
  const frames: import("@pstdio/sdk/extensions").ChatRendererEvent[] = [];
  const queue = { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null };
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
        getQueuedMessages: async () => ({ messages: [], queue }),
        getExecutionState: async () => ({ kind: "local", available: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({ close: () => {} }),
        stream: async (_id, onEvent) => {
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [] } });
          for (let index = 0; index < 30; index++) {
            await onEvent({
              event: "patch",
              data: {
                op: "add",
                path: `/messages/${index}`,
                value: {
                  id: `reply-${index}`,
                  role: "assistant",
                  parts: [{ type: "text", text: "x".repeat(3072) }],
                },
              },
            });
          }
          await onEvent({ event: "queued_messages", data: { queue, messages: [] } });
          controller.abort();
        },
      },
    },
  });
  await watchConversation(ctx, { type: "session", id: "s" });
  const last = frames.at(-1)!;
  expect(last).toMatchObject({ snapshot: { queuedFollowUps: [], queueReadOnly: false } });
  expect(JSON.stringify(last)).not.toContain("reply-0");
  expect(new TextEncoder().encode(JSON.stringify(last)).byteLength).toBeLessThan(64 * 1024);
});

test("cancelling while presence and queue reads are pending owns both rejections and closes the hold", async () => {
  const controller = new AbortController();
  let closed = 0;
  let reads = 0;
  const untilAbort = () =>
    new Promise<never>((_, reject) => {
      reads++;
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
    });
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      signal: controller.signal,
      sessions: {
        retainResources: async () => ({
          close: () => {
            closed++;
          },
        }),
        getExecutionState: untilAbort,
        getQueuedMessages: untilAbort,
      },
    },
  });
  const watching = watchConversation(ctx, { type: "session", id: "s" }).catch((error) => error);
  await Bun.sleep(0);
  expect(reads).toBe(2);
  controller.abort();
  expect((await watching).name).toBe("AbortError");
  await Bun.sleep(0);
  expect(closed).toBe(1);
});

test("a saved read-only queue checkpoint yields to the next editable online owner read", async () => {
  const controller = new AbortController();
  const events: Array<{ snapshot?: { queueReadOnly?: boolean } }> = [];
  const queue = { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null };
  let reads = 0;
  let checkpoint = false;
  let closed = 0;
  let changed: (() => void) | undefined;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (value) => {
          const event = value as { snapshot?: { queueReadOnly?: boolean } };
          events.push(event);
          if (event.snapshot?.queueReadOnly === true) checkpoint = true;
          if (checkpoint && event.snapshot?.queueReadOnly === false) controller.abort();
        },
      },
      sessions: {
        observeMetadata: async (_id, notify) => {
          changed = () => notify("session");
          return { close() {} };
        },
        get: async () => ({ ...session, status: "in_progress" }),
        getExecutionState: async () => ({
          kind: "remote",
          available: true,
          device: { id: "owner", name: "Laptop", ownerId: "account" },
        }),
        getQueuedMessages: async () => {
          reads++;
          return { messages: [], queue };
        },
        retainResources: async () => ({
          close: () => {
            closed++;
          },
        }),
        stream: async (_id, onEvent) => {
          await onEvent({ event: "queued_messages", data: { messages: [], queue: { ...queue, readOnly: true } } });
          changed!();
          await new Promise<void>((resolve) => {
            if (controller.signal.aborted) resolve();
            else controller.signal.addEventListener("abort", () => resolve(), { once: true });
          });
        },
      },
    },
  });
  await watchConversation(ctx, { type: "session", id: "s" });
  expect(
    events.flatMap((event) =>
      typeof event.snapshot?.queueReadOnly === "boolean" ? [event.snapshot.queueReadOnly] : [],
    ),
  ).toEqual([false, true, false]);
  expect(reads).toBe(2);
  expect(closed).toBe(1);
});

test("a draft view keeps its declared shared watch until disposal without retaining execution resources", async () => {
  const controller = new AbortController();
  let retained = 0;
  let ended = false;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      sessions: {
        retainResources: async () => {
          retained++;
          return { close: () => {} };
        },
      },
    },
  });
  const watching = watchConversation(ctx).finally(() => {
    ended = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  const endedWhileVisible = ended;
  controller.abort();
  await watching;
  expect(endedWhileVisible).toBe(false);
  expect(ended).toBe(true);
  expect(retained).toBe(0);
});

test("a late queue refresh cannot overwrite a newer stream steering capability", async () => {
  const controller = new AbortController();
  const refreshing = Promise.withResolvers<void>();
  const releaseRefresh = Promise.withResolvers<void>();
  const connected = Promise.withResolvers<void>();
  const queue = {
    requests: [],
    activeRunStartedAt: null,
    steeringAvailable: false,
    steeringUnavailableReason: "The harness cannot steer",
  };
  const events: Array<{ snapshot?: { queueSteeringUnavailableReason?: string | null } }> = [];
  let onQueue: (() => Promise<void>) | undefined;
  let reads = 0;
  let closed = 0;
  let changed: (() => void) | undefined;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (value) => {
          events.push(value as never);
          if (events.length === 3) controller.abort();
        },
      },
      sessions: {
        observeMetadata: async (_id, notify) => {
          changed = () => notify("session");
          return { close() {} };
        },
        get: async () => session,
        getExecutionState: async () => {
          if (++reads === 2) {
            refreshing.resolve();
            await releaseRefresh.promise;
          }
          return { kind: "local", available: true };
        },
        getQueuedMessages: async () => ({ messages: [], queue }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({ close: () => closed++ }),
        stream: async (_id, onEvent) => {
          onQueue = async () => {
            await onEvent({
              event: "queued_messages",
              data: {
                messages: [],
                queue: { ...queue, steeringAvailable: true, steeringUnavailableReason: null },
              },
            });
          };
          connected.resolve();
          await new Promise<void>((resolve) =>
            controller.signal.addEventListener("abort", () => resolve(), { once: true }),
          );
        },
      },
    },
  });
  const watching = watchConversation(ctx, { type: "session", id: "s" });
  try {
    await connected.promise;
    changed!();
    await refreshing.promise;
    await onQueue!();
    releaseRefresh.resolve();
    await Bun.sleep(0);
    controller.abort();
    await watching;
    expect(
      events.flatMap((event) =>
        event.snapshot && Object.hasOwn(event.snapshot, "queueSteeringUnavailableReason")
          ? [event.snapshot.queueSteeringUnavailableReason]
          : [],
      ),
    ).toEqual(["The harness cannot steer", null]);
    expect(closed).toBe(1);
  } finally {
    releaseRefresh.resolve();
    controller.abort();
    await watching;
  }
});

test("an idle turn tells the person the agent is waiting and which background tasks still run", async () => {
  const controller = new AbortController();
  const ended = Promise.withResolvers<void>();
  const notices: unknown[] = [];
  const idleTurn = { backgroundTasks: [{ id: "watch", description: "Watch the extension for changes" }] };
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    overrides: {
      signal: controller.signal,
      stream: {
        write: async (event) => {
          const snapshot = (event as { snapshot?: { notice?: string } }).snapshot;
          if (snapshot && "notice" in snapshot) notices.push(snapshot.notice);
        },
      },
      sessions: {
        get: async () => ({ ...session, status: "in_progress" as const }),
        getConversation: async () => ({ session, messages: [] }),
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: true, steeringUnavailableReason: null },
        }),
        getExecutionState: async () => ({ kind: "local", available: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        retainResources: async () => ({ close: () => {} }),
        stream: async (_id, onEvent) => {
          await onEvent({ event: "patch", data: { op: "replace", path: "/messages", value: [] } });
          notices.length = 0;
          await onEvent({ event: "patch", data: { op: "replace", path: "/idle_turn", value: idleTurn } });
          await onEvent({ event: "patch", data: { op: "replace", path: "/idle_turn", value: null } });
          // A later queue error stays when the next idle turn ends.
          await onEvent({ event: "patch", data: { op: "replace", path: "/idle_turn", value: idleTurn } });
          await onEvent({ event: "queued_messages", data: { error: "Could not refresh queued messages" } });
          await onEvent({ event: "patch", data: { op: "replace", path: "/idle_turn", value: null } });
          ended.resolve();
        },
      },
    },
  });
  const watching = watchConversation(ctx, { type: "session", id: "s" });
  await ended.promise;
  controller.abort();
  await watching;
  expect(notices).toHaveLength(4);
  expect(notices[0]).toContain("Watch the extension for changes");
  expect(notices[1]).toBe("");
  expect(notices[3]).toBe("Could not refresh queued messages");
});
