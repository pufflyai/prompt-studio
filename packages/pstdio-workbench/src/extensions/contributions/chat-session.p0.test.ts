import { expect, test } from "bun:test";
import { visibleChatDraftAttachments } from "./chat-pending-submission";
import { createChatSession } from "./chat-session";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const message = (text: string) => ({ id: "m", role: "assistant" as const, parts: [{ type: "text" as const, text }] });

test("a failed message fork rejects to its control without changing conversation error, history or draft", async () => {
  const failure = new Error("This harness does not support forking conversations.");
  const session = createChatSession({
    initial: { messages: [message("Saved reply")], fork: { disabledReason: null } },
    query: async () => ({}),
    action: async () => {
      throw failure;
    },
  });
  session.changeDraft({ text: "Keep typing", values: { model: "saved-model" } });
  const before = session.getSnapshot();
  await expect(session.run({ type: "fork", messageId: "m" })).rejects.toBe(failure);
  expect(session.getSnapshot().error).toBeUndefined();
  expect(session.getSnapshot().messages).toBe(before.messages);
  expect(session.getSnapshot().draft).toBe(before.draft);
});

test("message fork failures preserve existing connection feedback and other action failures remain visible", async () => {
  const session = createChatSession({
    query: async () => ({}),
    action: async (action) => {
      throw new Error(action.type === "fork" ? "Fork failed" : "Refresh failed");
    },
  });
  session.reportError(new Error("Connection lost"));
  await expect(session.run({ type: "fork", messageId: "m" })).rejects.toThrow("Fork failed");
  expect(session.getSnapshot().error).toBe("Connection lost");
  await expect(session.run({ type: "operation", id: "refresh", values: {} })).rejects.toThrow("Refresh failed");
  expect(session.getSnapshot().error).toBe("Refresh failed");
});

test("post-submit native recovery preserves drafts that were already recovered", async () => {
  const earlier = { text: "Earlier work", attachments: [{ id: "B", name: "B.txt" }], values: { model: "B" } };
  const failed = { text: "Send work", attachments: [{ id: "A", name: "A.txt" }], values: { model: "A" } };
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  session.changeDraft({ ...failed, recovered: [earlier] });
  await session.run({ type: "submit", ...failed });
  session.accept({ revision: 0, recoverDraft: { ...failed, recovered: [] } });
  await session.flushDraft();
  expect(saved).toEqual({ ...failed, recovered: [earlier] });
});

test("native recovery retains hydrated unsent work even without a local edit", async () => {
  const newer = { text: "Saved newer body", attachments: [{ id: "B", name: "B.txt" }], values: { model: "B" } };
  const older = { text: "Failed older body", attachments: [{ id: "A", name: "A.txt" }], values: { model: "A" } };
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    loadDraft: async () => newer,
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  const release = session.retain();
  await Promise.resolve();
  await Promise.resolve();
  expect(session.getSnapshot().draft).toEqual(newer);
  session.accept({ revision: 0, recoverDraft: older });
  await session.flushDraft();
  expect(saved).toEqual({ ...newer, recovered: [older] });
  release();
});

test("late native-operation recovery saves failed work without replacing a newer draft after the view closes", async () => {
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  const failed = { text: "Native objective", attachments: [{ id: "A", name: "A.txt" }], values: { model: "B" } };
  session.accept({ revision: 1, recoverDraft: failed });
  await session.flushDraft();
  expect(saved).toEqual(failed);
  session.changeDraft({ text: "New work", attachments: [{ id: "B", name: "B.txt" }], values: { model: "C" } });
  session.dispose();
  session.accept({ revision: 2, recoverDraft: failed });
  await session.flushDraft();
  expect(saved).toMatchObject({
    text: "New work",
    attachments: [{ id: "B" }],
    values: { model: "C" },
    recovered: [failed],
  });
  session.accept({ revision: 2, recoverDraft: failed });
  expect(session.getSnapshot().draft.recovered).toHaveLength(1);
});

test("degraded queues block edits while questions and stop remain available and preserve typing", async () => {
  const actions: string[] = [];
  const session = createChatSession({
    initial: { queueReadOnly: true },
    query: async () => ({}),
    action: async (action) => {
      actions.push(action.type);
    },
  });
  session.changeDraft({ text: "Unsent work" });
  const edit = {
    type: "queue" as const,
    operation: "update" as const,
    item: { id: "q", prompt: "Queued" },
    values: {},
    attachments: [],
  };
  await expect(session.run(edit)).rejects.toThrow("queue is read-only");
  await session.run({ type: "stop" });
  await session.run({
    type: "submit",
    text: "",
    values: {},
    attachments: [],
    questionResponse: { callId: "q", answers: [["Yes"]] },
  });
  expect(session.getSnapshot().draft.text).toBe("Unsent work");
  session.accept({ revision: 1, snapshot: { queueReadOnly: false } });
  await session.run(edit);
  expect(actions).toEqual(["stop", "submit", "queue"]);
});

test("composer state exists before delayed reads, and live data wins the snapshot handoff", async () => {
  const query = deferred<{ messages: ReturnType<typeof message>[] }>();
  const session = createChatSession({
    initial: { messages: [message("cached")] },
    query: () => query.promise,
    action: async () => undefined,
  });
  expect(session.getSnapshot().conversation.messages?.[0]?.parts[0]).toEqual({ type: "text", text: "cached" });
  expect(session.getSnapshot().draft.text).toBe("");
  const release = session.retain();
  session.accept({ revision: 1, snapshot: { messages: [message("live")] } });
  query.resolve({ messages: [message("stale")] });
  await query.promise;
  await session.query.read();
  expect(session.getSnapshot().conversation.messages?.[0]?.parts[0]).toEqual({ type: "text", text: "live" });
  session.accept({ revision: 1, snapshot: { messages: [message("duplicate")] } });
  expect(session.getSnapshot().conversation.messages).toHaveLength(1);
  release();
});

test("late draft hydration cannot replace typing; save order preserves the latest draft", async () => {
  const draft = deferred<{ text: string; attachments: []; values: Record<string, never> }>();
  const saved: string[] = [];
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    loadDraft: () => draft.promise,
    saveDraft: async (value) => {
      saved.push(value.text);
    },
  });
  const release = session.retain();
  session.changeDraft({ text: "typing" });
  draft.resolve({ text: "old", attachments: [], values: {} });
  await draft.promise;
  await session.flushDraft();
  expect(session.getSnapshot().draft.text).toBe("typing");
  expect(saved.at(-1)).toBe("typing");
  release();
});

test("typing before hydration preserves the older saved text and files for recovery", async () => {
  const previous = { text: "Saved work", attachments: [{ id: "old-file", name: "old.txt" }], values: {} };
  const hydration = deferred<typeof previous>();
  const saved: unknown[] = [];
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    loadDraft: () => hydration.promise,
    saveDraft: async (draft) => {
      saved.push(draft);
    },
  });
  const release = session.retain();
  session.changeDraft({ text: "New typing" });
  await Promise.resolve();
  expect(saved).toEqual([]);
  hydration.resolve(previous);
  await session.flushDraft();
  expect(session.getSnapshot().draft).toMatchObject({ text: "New typing", recovered: [previous] });
  expect(saved.at(-1)).toMatchObject({ text: "New typing", recovered: [previous] });
  session.restoreDraft(0);
  await session.flushDraft();
  expect(session.getSnapshot().draft).toMatchObject({ ...previous, recovered: [{ text: "New typing" }] });
  release();
});

test("a stream notice does not discard delayed history or controls", async () => {
  const query = deferred<{ messages: ReturnType<typeof message>[] }>();
  const session = createChatSession({ query: () => query.promise, action: async () => undefined });
  const release = session.retain();
  session.accept({ revision: 0, snapshot: { notice: "Connected" } });
  query.resolve({ messages: [message("hydrated")] });
  await query.promise;
  await session.query.read();
  expect(session.getSnapshot().conversation.messages).toHaveLength(1);
  expect(session.getSnapshot().conversation.notice).toBe("Connected");
  release();
});

test("duplicate submit is one action; disposing a view aborts its stream without stopping execution", async () => {
  const sent = deferred<void>();
  const actions: string[] = [];
  let signal: AbortSignal | undefined;
  const session = createChatSession({
    query: async () => ({}),
    action: async (action) => {
      actions.push(action.type);
      await sent.promise;
    },
    watch: async function* (abort) {
      signal = abort;
      await new Promise<void>((done) => abort.addEventListener("abort", () => done(), { once: true }));
    },
  });
  const release = session.retain();
  const action = { type: "submit" as const, text: "Run", attachments: [], values: {} };
  const first = session.run(action);
  const second = session.run(action);
  release();
  expect(signal?.aborted).toBe(true);
  sent.resolve();
  await Promise.all([first, second]);
  expect(actions).toEqual(["submit"]);
});

test("reconnecting keeps displayed messages and scopes revisions to the new connection", async () => {
  const session = createChatSession({ query: async () => ({}), action: async () => undefined });
  const release = session.retain();
  session.accept({ revision: 9, snapshot: { messages: [message("previous")] } });
  session.reconnect();
  expect(session.getSnapshot().conversation.messages).toHaveLength(1);
  session.accept({ revision: 0, snapshot: { messages: [message("resumed")] } });
  expect(session.getSnapshot().conversation.messages?.[0]?.parts[0]).toEqual({ type: "text", text: "resumed" });
  release();
});

test("a disconnected SDK command stream reports its rejected result after chunks finish", async () => {
  const result = deferred<unknown>();
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    watch: () =>
      Object.assign(
        (async function* () {
          yield { revision: 0, snapshot: { notice: "Connected" } };
        })(),
        {
          result: result.promise.then(() => {
            throw new Error("Connection lost");
          }),
        },
      ),
  });
  const release = session.retain();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  result.resolve(undefined);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(session.getSnapshot().error).toBe("Connection lost");
  release();
});

test("incremental events require a fresh stream transcript before they can supersede a delayed read", async () => {
  const query = deferred<{ messages: ReturnType<typeof message>[] }>();
  const session = createChatSession({ query: () => query.promise, action: async () => undefined });
  const release = session.retain();
  expect(() =>
    session.accept({ revision: 1, patch: { op: "replace", path: "/messages/0", value: message("patch") } }),
  ).toThrow();
  query.resolve({ messages: [message("history")] });
  await query.promise;
  await session.query.read();
  expect(session.getSnapshot().conversation.messages?.[0]?.parts[0]).toEqual({ type: "text", text: "history" });
  session.accept({ revision: 2, snapshot: { messages: [message("current")] } });
  session.accept({ revision: 3, patch: { op: "replace", path: "/messages/0", value: message("live") } });
  expect(session.getSnapshot().conversation.messages?.[0]?.parts[0]).toEqual({ type: "text", text: "live" });
  release();
});

test("a slow submission preserves a newer draft including its attachments", async () => {
  const sent = deferred<void>();
  const session = createChatSession({ query: async () => ({}), action: () => sent.promise });
  session.changeDraft({ text: "old" });
  const pending = session.run({ type: "submit", text: "old", attachments: [], values: {} });
  session.changeDraft({ text: "new", attachments: [{ id: "file", name: "file.txt" }] });
  sent.resolve();
  await pending;
  expect(session.getSnapshot().draft).toMatchObject({ text: "new", attachments: [{ id: "file" }] });
});

test("delayed action results and queries cannot replace a newer stream transcript", async () => {
  const actionResult = deferred<unknown>();
  const queryResult = deferred<unknown>();
  const session = createChatSession({ query: () => queryResult.promise, action: () => actionResult.promise });
  const release = session.retain();
  const pending = session.run({ type: "stop" });
  session.accept({ revision: 4, snapshot: { messages: [message("live")] } });
  actionResult.resolve({ snapshot: { messages: [message("old action")] } });
  queryResult.resolve({ messages: [message("old read")] });
  await pending;
  expect(session.getSnapshot().conversation.messages?.[0]?.parts[0]).toEqual({ type: "text", text: "live" });
  release();
});

test("Retry actually retries a failed draft save before clearing its error", async () => {
  let attempts = 0;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    saveDraft: async () => {
      if (++attempts === 1) throw new Error("Disk full");
    },
  });
  const release = session.retain();
  session.changeDraft({ text: "Keep this" });
  await session.flushDraft();
  expect(session.getSnapshot().error).toBe("Disk full");
  session.reconnect();
  expect(session.getSnapshot().error).toBe("Disk full");
  await session.flushDraft();
  expect(attempts).toBe(2);
  expect(session.getSnapshot().error).toBeUndefined();
  release();
});

test("an empty saved control map retains values already read from the session", async () => {
  const hydration = deferred<{ text: string; attachments: []; values: Record<string, never> }>();
  const session = createChatSession({
    query: async () => ({ values: { model: "session-model", effort: "high" } }),
    action: async () => undefined,
    loadDraft: () => hydration.promise,
  });
  const release = session.retain();
  await Promise.resolve();
  hydration.resolve({ text: "", attachments: [], values: {} });
  await hydration.promise;
  await session.query.read();
  expect(session.getSnapshot().draft.values).toEqual({ model: "session-model", effort: "high" });
  release();
});

test("closing a view while draft hydration is pending still saves unsent work", async () => {
  const hydration = deferred<{ text: string; attachments: []; values: Record<string, never> }>();
  const saved: unknown[] = [];
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    loadDraft: () => hydration.promise,
    saveDraft: async (draft) => {
      saved.push(draft);
    },
  });
  const release = session.retain();
  session.changeDraft({ text: "Do not lose this" });
  release();
  hydration.resolve({ text: "", attachments: [], values: {} });
  await session.flushDraft();
  expect(saved.at(-1)).toMatchObject({ text: "Do not lose this" });
});

test("query values replace static defaults while locally selected controls win delayed reads", async () => {
  const untouched = createChatSession({
    initial: { values: { model: "default" } },
    query: async () => ({ values: { model: "saved" } }),
    action: async () => undefined,
  });
  const closeUntouched = untouched.retain();
  await untouched.query.read();
  expect(untouched.getSnapshot().draft.values).toEqual({ model: "saved" });
  closeUntouched();
  const query = deferred<{ values: { model: string; effort: string } }>();
  const session = createChatSession({
    initial: { values: { model: "default", effort: "default" } },
    query: () => query.promise,
    action: async () => undefined,
  });
  const release = session.retain();
  session.changeDraft({ values: { model: "selected" } });
  query.resolve({ values: { model: "saved", effort: "high" } });
  await query.promise;
  await session.query.read();
  expect(session.getSnapshot().draft.values).toEqual({ model: "selected", effort: "high" });
  release();
});

test("answering a native question preserves the unsent message and its files", async () => {
  const actions: unknown[] = [];
  const session = createChatSession({
    query: async () => ({}),
    action: async (action) => {
      actions.push(action);
    },
  });
  const draft = { text: "Unsent follow-up", attachments: [{ id: "file", name: "draft.txt" }], values: {} };
  session.changeDraft(draft);
  const action = {
    type: "submit" as const,
    text: "Browser",
    attachments: [],
    values: {},
    questionResponse: { callId: "question", answers: [["Browser"]] },
  };
  await session.run(action);
  expect(actions).toEqual([action]);
  expect(session.getSnapshot().draft).toEqual(draft);
});

test("restoring fewer controls releases removed ownership and keeps the recovered draft editable", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => undefined });
  session.changeDraft({ text: "Current", values: { model: "A", effort: "high" } });
  session.accept({ revision: 1, recoverDraft: { text: "Legacy", attachments: [], values: { effort: "low" } } });
  session.restoreDraft(0);
  session.accept({ revision: 2, snapshot: { values: { model: "B", effort: "default" } } });
  expect(() => session.changeDraft({ text: "Legacy edited" })).not.toThrow();
  expect(session.getSnapshot().draft.values).toEqual({ model: "B", effort: "low" });
  session.accept({ revision: 3, snapshot: { values: { model: "C", effort: "default" } } });
  expect(session.getSnapshot().draft.values).toEqual({ model: "C", effort: "low" });
  expect(session.getSnapshot().draft.recovered).toEqual([
    { text: "Current", attachments: [], values: { model: "A", effort: "high" } },
  ]);
});

test("provider values can clear an unchanged intent and persist without another keystroke", async () => {
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => ({ snapshot: { values: { intent: "" } } }),
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  session.changeDraft({
    text: "Keep objective",
    attachments: [{ id: "A", name: "A.txt" }],
    values: { intent: "/goal", model: "A" },
  });
  await session.run({ type: "operation", id: "clear-intent", values: session.getSnapshot().draft.values });
  await session.flushDraft();
  expect(saved).toMatchObject({
    text: "Keep objective",
    attachments: [{ id: "A" }],
    values: { intent: "", model: "A" },
  });
  const untouched = createChatSession({
    query: async () => ({}),
    action: async () => ({ snapshot: { values: { intent: "/goal" } } }),
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  await untouched.run({ type: "selectCommand", name: "/goal", values: {} });
  await untouched.flushDraft();
  expect(saved).toMatchObject({ values: { intent: "/goal" } });
});

test("delayed provider values preserve newer controls, text and files while updating untouched keys", async () => {
  const response = deferred<unknown>();
  const session = createChatSession({ query: async () => ({}), action: () => response.promise });
  session.changeDraft({ text: "Objective", values: { model: "A", intent: "" } });
  const selecting = session.run({ type: "selectCommand", name: "/goal", values: session.getSnapshot().draft.values });
  session.changeDraft({
    text: "New objective",
    attachments: [{ id: "B", name: "B.txt" }],
    values: { model: "B", intent: "" },
  });
  response.resolve({ snapshot: { values: { model: "A", intent: "/goal" } } });
  await selecting;
  expect(session.getSnapshot().draft).toMatchObject({
    text: "New objective",
    attachments: [{ id: "B" }],
    values: { model: "B", intent: "/goal" },
  });
});

test("provider-only metadata updates do not prevent a successful submission from clearing its unchanged body", async () => {
  const session = createChatSession({
    query: async () => ({}),
    action: async () => ({ snapshot: { values: { intent: "" } } }),
  });
  session.changeDraft({ text: "Objective", attachments: [{ id: "A", name: "A.txt" }], values: { intent: "/goal" } });
  await session.run({
    type: "submit",
    text: "Objective",
    attachments: session.getSnapshot().draft.attachments,
    values: session.getSnapshot().draft.values,
  });
  expect(session.getSnapshot().draft).toEqual({ text: "", attachments: [], values: { intent: "" } });
});

test("delayed command values survive unrelated live controls and persist after closing", async () => {
  const response = deferred<unknown>();
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({}),
    action: () => response.promise,
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  const close = session.retain();
  session.accept({ revision: 0, snapshot: { values: { model: "A" } } });
  const selecting = session.run({ type: "selectCommand", name: "/goal", values: { model: "A" } });
  session.accept({ revision: 1, snapshot: { values: { workspace: "W" } } });
  close();
  response.resolve({ snapshot: { values: { intent: "/goal" } } });
  await selecting;
  await session.flushDraft();
  expect(session.getSnapshot().draft.values).toEqual({ model: "A", workspace: "W", intent: "/goal" });
  expect(saved).toMatchObject({ values: { model: "A", workspace: "W", intent: "/goal" } });
});

test("a newer query value protects only its own key from an older action", async () => {
  const response = deferred<unknown>();
  const query = deferred<unknown>();
  const session = createChatSession({ query: () => query.promise, action: () => response.promise });
  session.accept({ revision: 0, snapshot: { values: { model: "A" } } });
  const selecting = session.run({ type: "selectCommand", name: "/goal", values: { model: "A" } });
  const close = session.retain();
  query.resolve({ values: { model: "B" } });
  await query.promise;
  await session.query.read();
  response.resolve({ snapshot: { values: { model: "A", intent: "/goal" } } });
  await selecting;
  expect(session.getSnapshot().draft.values).toEqual({ model: "B", intent: "/goal" });
  close();
});

test("changing a control away and back still protects it from an older action", async () => {
  const response = deferred<unknown>();
  const session = createChatSession({ query: async () => ({}), action: () => response.promise });
  session.changeDraft({ values: { model: "A" } });
  const selecting = session.run({ type: "selectCommand", name: "/goal", values: { model: "A" } });
  session.changeDraft({ values: { model: "B" } });
  session.changeDraft({ values: { model: "A" } });
  response.resolve({ snapshot: { values: { model: "outdated", intent: "/goal" } } });
  await selecting;
  expect(session.getSnapshot().draft.values).toEqual({ model: "A", intent: "/goal" });
});

test("a query echo of a locally owned value does not suppress an unchanged delayed command intent", async () => {
  const response = deferred<unknown>();
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({ values: { intent: "" } }),
    action: () => response.promise,
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  session.changeDraft({ values: { intent: "" } });
  const selecting = session.run({ type: "selectCommand", name: "/goal", values: { intent: "" } });
  const close = session.retain();
  await Promise.resolve();
  response.resolve({ snapshot: { values: { intent: "/goal" } } });
  await selecting;
  await session.flushDraft();
  expect(saved).toMatchObject({ values: { intent: "/goal" } });
  close();
});

test("native controls wait for query and saved settings while the first-paint composer accepts typing", async () => {
  const query = deferred<{ controls: []; values: { harness: { harnessId: string } } }>();
  const hydration = deferred<{
    text: string;
    attachments: [];
    values: { harness: { harnessId: string; model: string } };
  }>();
  const session = createChatSession({
    query: () => query.promise,
    loadDraft: () => hydration.promise,
    action: async () => undefined,
  });
  const release = session.retain();
  expect(session.getSnapshot().initializing).toBe(true);
  session.changeDraft({ text: "Typed before reads" });
  session.accept({ revision: 0, snapshot: { notice: "Connected" } });
  expect(session.getSnapshot().initializing).toBe(true);
  query.resolve({ controls: [], values: { harness: { harnessId: "session-harness" } } });
  await query.promise;
  await session.query.read();
  expect(session.getSnapshot().initializing).toBe(true);
  hydration.resolve({
    text: "",
    attachments: [],
    values: { harness: { harnessId: "session-harness", model: "saved" } },
  });
  await hydration.promise;
  await new Promise((done) => setTimeout(done, 0));
  expect(session.getSnapshot().initializing).toBe(false);
  expect(session.getSnapshot().draft.text).toBe("Typed before reads");
  expect(session.getSnapshot().draft.values.harness).toEqual({ harnessId: "session-harness", model: "saved" });
  release();
});

test("hydration preserves explicitly edited control keys alongside other saved settings", async () => {
  const hydration = deferred<{ text: string; attachments: []; values: { model: string; workspace: string } }>();
  let saved: unknown;
  const session = createChatSession({
    query: async () => ({ values: { model: "query-A", workspace: "query-workspace" } }),
    loadDraft: () => hydration.promise,
    saveDraft: async (draft) => {
      saved = draft;
    },
    action: async () => undefined,
  });
  const release = session.retain();
  await Promise.resolve();
  session.changeDraft({
    text: "New work",
    values: { ...session.getSnapshot().draft.values, workspace: "user-workspace" },
  });
  hydration.resolve({
    text: "Older work",
    attachments: [],
    values: { model: "saved-B", workspace: "saved-workspace" },
  });
  await session.flushDraft();
  expect(session.getSnapshot().draft).toMatchObject({
    text: "New work",
    values: { model: "saved-B", workspace: "user-workspace" },
  });
  expect(saved).toMatchObject({ text: "New work", values: { model: "saved-B", workspace: "user-workspace" } });
  release();
});

test("restoring a draft claims its settings even when they equal untouched query defaults", async () => {
  const hydration = deferred<{ text: string; attachments: []; values: { model: string } }>();
  const session = createChatSession({
    query: async () => ({ values: { model: "A" } }),
    loadDraft: () => hydration.promise,
    action: async () => undefined,
  });
  const release = session.retain();
  await session.query.read();
  session.accept({ revision: 0, recoverDraft: { text: "Recovered work", attachments: [], values: { model: "A" } } });
  session.restoreDraft(0);
  hydration.resolve({ text: "Older saved work", attachments: [], values: { model: "B" } });
  await new Promise((done) => setTimeout(done, 0));
  expect(session.getSnapshot().draft).toMatchObject({ text: "Recovered work", values: { model: "A" } });
  release();
});

test("a held submission belongs to its shared owner, shows files once and reconciles a canonical echo", async () => {
  const held = deferred<unknown>();
  const attachment = { id: "A", name: "diagram.png", url: "/files/A", mediaType: "image/png" };
  const prior = { id: "previous", role: "user" as const, parts: [{ type: "text" as const, text: "Send diagram" }] };
  const session = createChatSession({
    initial: { messages: [prior] },
    query: async () => ({}),
    action: () => held.promise,
  });
  session.changeDraft({ attachments: [attachment] });
  const pending = session.run({ type: "submit", text: "Send diagram", attachments: [attachment], values: {} });
  expect(session.getSnapshot().messages).toHaveLength(3);
  const optimistic = session.getSnapshot().messages[1];
  expect(visibleChatDraftAttachments(session.getSnapshot().draft.attachments, session.getSnapshot().pending)).toEqual(
    [],
  );
  const newerFiles = [...session.getSnapshot().draft.attachments, { id: "B", name: "B.txt" }];
  expect(visibleChatDraftAttachments(newerFiles, session.getSnapshot().pending)).toEqual([{ id: "B", name: "B.txt" }]);
  expect(optimistic.parts).toEqual([
    { type: "text", text: "Send diagram" },
    { type: "file", fileId: "A", filename: "diagram.png", mediaType: "image/png", url: "/files/A" },
  ]);
  const release = session.retain();
  release();
  const reopen = session.retain();
  expect(session.getSnapshot().messages[1].id).toBe(optimistic.id);
  const confirmed = { ...optimistic, id: "confirmed" };
  session.accept({ revision: 1, snapshot: { messages: [prior, confirmed] } });
  expect(session.getSnapshot().messages).toHaveLength(2);
  expect(session.getSnapshot().messages[1].animationKey).toBe(optimistic.id);
  held.resolve({});
  await pending;
  expect(session.getSnapshot().messages).toHaveLength(2);
  expect(session.getSnapshot().draft.attachments).toEqual([]);
  reopen();
});

test("a failed held submission restores its text and files after its presentation closes", async () => {
  let reject!: (error: Error) => void;
  const held = new Promise((_, fail) => {
    reject = fail;
  });
  const attachment = { id: "A", name: "A.txt", url: "/files/A" };
  const session = createChatSession({ query: async () => ({}), action: () => held });
  session.changeDraft({ attachments: [attachment] });
  const release = session.retain();
  const pending = session.run({ type: "submit", text: "Keep this", attachments: [attachment], values: {} });
  release();
  reject(new Error("Unavailable"));
  await expect(pending).rejects.toThrow("Unavailable");
  expect(session.getSnapshot().messages).toEqual([]);
  expect(session.getSnapshot().draft).toMatchObject({ text: "Keep this", attachments: [attachment] });
});

test("rejected pending work cannot overwrite a newer draft and never enters canonical patch indexes", async () => {
  let reject!: (error: Error) => void;
  const held = new Promise((_, fail) => {
    reject = fail;
  });
  const session = createChatSession({
    initial: { messages: [message("History")] },
    query: async () => ({}),
    action: () => held,
  });
  const pending = session.run({ type: "submit", text: "Old", attachments: [{ id: "A", name: "A.txt" }], values: {} });
  expect(session.getSnapshot().conversation.messages).toHaveLength(1);
  session.accept({ revision: 0, snapshot: { messages: [message("History")] } });
  session.accept({ revision: 1, patch: { op: "replace", path: "/messages/0", value: message("Changed") } });
  expect(session.getSnapshot().messages[0].parts[0]).toEqual({ type: "text", text: "Changed" });
  session.changeDraft({ text: "Newer", attachments: [{ id: "B", name: "B.txt" }] });
  reject(new Error("Unavailable"));
  await expect(pending).rejects.toThrow("Unavailable");
  expect(session.getSnapshot().draft).toMatchObject({
    text: "Newer",
    attachments: [{ id: "B" }],
    recovered: [{ text: "Old", attachments: [{ id: "A" }] }],
  });
  expect(session.getSnapshot().messages).toHaveLength(1);
});

test("closing the last owner returns a watch iterator even when it has one buffered event", async () => {
  const gate = deferred<void>();
  let returned = false;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => ({}),
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        try {
          yield { revision: 0, snapshot: { notice: "Connected" } };
          await gate.promise;
          yield { revision: 1, snapshot: { notice: "Buffered" } };
          await new Promise(() => {});
        } finally {
          returned = true;
        }
      },
    }),
  });
  const release = session.retain();
  await new Promise((done) => setTimeout(done, 0));
  release();
  gate.resolve();
  await new Promise((done) => setTimeout(done, 0));
  expect(returned).toBe(true);
  expect(session.getSnapshot().conversation.notice).toBe("Connected");
});

test("accepted input stays visible until its delayed canonical echo without holding the request lock", async () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  await session.run({ type: "submit", text: "Send", attachments: [], values: {} });
  expect(session.getSnapshot().sending).toBe(false);
  expect(session.getSnapshot().messages.filter((item) => item.role === "user")).toHaveLength(1);
  session.accept({
    revision: 0,
    snapshot: { messages: [{ id: "echo", role: "user", parts: [{ type: "text", text: "Send" }] }] },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().messages).toHaveLength(1);
  expect(session.getSnapshot().messages[0].id).toBe("echo");
});

test("an explicit submitted-input result finishes an operation without manufacturing a transcript echo", async () => {
  const session = createChatSession({
    query: async () => ({}),
    action: async () => ({ snapshot: { sentTag: null, notice: "Operation complete" } }),
  });
  await session.run({ type: "submit", text: "/usage", attachments: [], values: {} });
  expect(session.getSnapshot().messages).toEqual([]);
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().conversation.notice).toBe("Operation complete");
});

test("consecutive identical submissions keep distinct pending rows and consume separate canonical echoes", async () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  const action = { type: "submit" as const, text: "Same", attachments: [], values: {} };
  await session.run(action);
  await session.run(action);
  expect(session.getSnapshot().messages.filter((item) => item.role === "user")).toHaveLength(2);
  const first = { id: "one", role: "user" as const, parts: [{ type: "text" as const, text: "Same" }] };
  session.accept({ revision: 0, snapshot: { messages: [first] } });
  expect(session.getSnapshot().messages.filter((item) => item.role === "user")).toHaveLength(2);
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({ revision: 1, snapshot: { messages: [first, { ...first, id: "two" }] } });
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().messages.map((item) => item.id)).toEqual(["one", "two"]);
  const displayed = session.getSnapshot().messages;
  session.changeDraft({ text: "Keep typing" });
  expect(session.getSnapshot().messages).toBe(displayed);
});

test("a loaded empty conversation stays usable during a same-owner reconnect", async () => {
  const pending = Promise.withResolvers<unknown>();
  let reads = 0;
  const session = createChatSession({
    query: () => (++reads === 1 ? Promise.resolve({ messages: [] }) : pending.promise),
    action: async () => ({}),
  });
  const release = session.retain();
  await new Promise<void>((resolve) => setImmediate(resolve));
  session.changeDraft({ text: "Unsent work" });
  expect(session.getSnapshot().loading).toBe(false);
  session.reconnect();
  expect(session.getSnapshot().loading).toBe(false);
  expect(session.getSnapshot().messages).toEqual([]);
  expect(session.getSnapshot().draft.text).toBe("Unsent work");
  pending.resolve({ messages: [] });
  await new Promise<void>((resolve) => setImmediate(resolve));
  release();
  await session.dispose();
});

test("retrying a failed first read remains loading until an authoritative snapshot is accepted", async () => {
  const pending = Promise.withResolvers<unknown>();
  let reads = 0;
  const session = createChatSession({
    query: async () => {
      if (++reads === 1) throw new Error("offline");
      return pending.promise;
    },
    action: async () => ({}),
  });
  const release = session.retain();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(session.getSnapshot().error).toBe("offline");
  session.reconnect();
  expect(session.getSnapshot().loading).toBe(true);
  pending.resolve({ messages: [] });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(session.getSnapshot().loading).toBe(false);
  release();
  await session.dispose();
});
