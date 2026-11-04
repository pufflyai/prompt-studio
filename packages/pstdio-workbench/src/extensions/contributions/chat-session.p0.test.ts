import { expect, test } from "bun:test";
import { createChatSession } from "./chat-session";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const message = (text: string) => ({ id: "m", role: "assistant" as const, parts: [{ type: "text" as const, text }] });

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
  await Promise.resolve();
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

test("a stream notice does not discard delayed history or controls", async () => {
  const query = deferred<{ messages: ReturnType<typeof message>[] }>();
  const session = createChatSession({ query: () => query.promise, action: async () => undefined });
  const release = session.retain();
  session.accept({ revision: 0, snapshot: { notice: "Connected" } });
  query.resolve({ messages: [message("hydrated")] });
  await query.promise;
  await Promise.resolve();
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

test("incremental events require a fresh stream transcript before they can supersede a delayed read", async () => {
  const query = deferred<{ messages: ReturnType<typeof message>[] }>();
  const session = createChatSession({ query: () => query.promise, action: async () => undefined });
  const release = session.retain();
  expect(() =>
    session.accept({ revision: 1, patch: { op: "replace", path: "/messages/0", value: message("patch") } }),
  ).toThrow();
  query.resolve({ messages: [message("history")] });
  await query.promise;
  await Promise.resolve();
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
