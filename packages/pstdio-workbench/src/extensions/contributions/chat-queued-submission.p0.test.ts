import { expect, test } from "bun:test";
import { createChatSession } from "./chat-session";

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const file = { id: "file-A", name: "A.txt" };
const action = { type: "submit" as const, text: "Queued work", attachments: [file], values: { model: "B" } };

test("held streaming sends retain one pending queue row across owner presentations without changing canonical messages", async () => {
  const held = deferred();
  const history = [{ id: "history", role: "assistant" as const, parts: [{ type: "text" as const, text: "Working" }] }];
  const session = createChatSession({
    initial: { streaming: true, messages: history },
    query: async () => ({}),
    action: () => held.promise,
  });
  session.changeDraft({ text: action.text, attachments: action.attachments, values: action.values });
  const sent = session.run(action);
  expect(session.getSnapshot().conversation.messages).toEqual(history);
  expect(session.getSnapshot().messages).toEqual(history);
  expect(session.getSnapshot().queuedFollowUps).toMatchObject([
    { prompt: action.text, attachments: [file], sending: true },
  ]);
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({
    revision: 1,
    snapshot: { queuedFollowUps: [{ id: "saved", prompt: action.text, attachments: [file] }] },
  });
  expect(session.getSnapshot().queuedFollowUps).toHaveLength(1);
  expect(session.getSnapshot().queuedFollowUps?.[0]?.id).toBe("saved");
  held.resolve({});
  await sent;
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().queuedFollowUps).toHaveLength(1);
});

test("question replies do not create a pending queue or consume the ordinary draft", async () => {
  const held = deferred();
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: () => held.promise,
  });
  session.changeDraft({ text: action.text, attachments: action.attachments, values: action.values });
  const sent = session.run({ ...action, attachments: [], questionResponse: { callId: "q", answers: [["Yes"]] } });
  expect(session.getSnapshot().pending).toBeUndefined();
  held.resolve({});
  await sent;
  expect(session.getSnapshot().draft.text).toBe(action.text);
  expect(session.getSnapshot().draft.attachments).toEqual([file]);
});

test("a rejected queued send stays recoverable until dismissed and survives durable recovery", async () => {
  const saved: unknown[] = [];
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => {
      throw new Error("Could not send");
    },
    saveDraft: async (draft) => {
      saved.push(draft);
    },
  });
  session.changeDraft({ text: "", attachments: [], values: action.values });
  await expect(session.run(action)).rejects.toThrow("Could not send");
  expect(session.getSnapshot().draft.text).toBe("");
  expect(session.getSnapshot().pending?.[0]?.failure).toBe("Could not send");
  expect(session.getSnapshot().messages).toMatchObject([{ role: "user", delivery: "unsent" }]);
  await session.flushDraft();
  expect(saved.at(-1)).toMatchObject({
    recovered: [{ text: action.text, attachments: [file], values: action.values }],
  });
  session.changeDraft({ text: "Newer work", attachments: [{ id: "B", name: "B.txt" }], values: { model: "A" } });
  session.restoreSubmission(session.getSnapshot().pending![0]!.message.id);
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().draft).toMatchObject({ text: action.text, attachments: [file], values: action.values });
  expect(session.getSnapshot().draft.recovered).toContainEqual({
    text: "Newer work",
    attachments: [{ id: "B", name: "B.txt" }],
    values: { model: "A" },
  });
});

test("identical queued sends claim separate receipts across refresh and canonical handoff", async () => {
  const session = createChatSession({
    initial: { streaming: true, messages: [] },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run(action);
  await session.run(action);
  const first = { id: "queued-first", prompt: action.text, attachments: [file] };
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [first] } });
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({ revision: 2, snapshot: { queuedFollowUps: [first] } });
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({
    revision: 3,
    snapshot: {
      queuedFollowUps: [],
      messages: [
        {
          id: "canonical-first",
          role: "user",
          parts: [
            { type: "text", text: action.text },
            { type: "file", fileId: file.id, filename: file.name, url: "" },
          ],
        },
      ],
    },
  });
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({ revision: 4, snapshot: { queuedFollowUps: [{ ...first, id: "queued-second" }] } });
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("a quickly consumed queue is acknowledged by canonical history, not an unrelated terminal response", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => ({ snapshot: { messages: [], streaming: false } }),
  });
  await session.run(action);
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({
    revision: 1,
    snapshot: {
      messages: [
        {
          id: "consumed",
          role: "user",
          parts: [
            { type: "text", text: action.text },
            { type: "file", fileId: file.id, filename: file.name, url: "" },
          ],
        },
      ],
    },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().queuedFollowUps).toEqual([]);
});

test("late delivery clears only a failure's own durable recovery and never offers delivered input for resubmission", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => {
      throw new Error("Transport failed");
    },
  });
  session.changeDraft({
    text: "Newer body",
    attachments: [],
    values: { model: "A" },
    recovered: [{ text: "Earlier recovery", attachments: [], values: {} }],
  });
  await expect(session.run(action)).rejects.toThrow("Transport failed");
  expect(session.getSnapshot().pending?.[0]?.failure).toBe("Transport failed");
  session.accept({
    revision: 1,
    snapshot: { queuedFollowUps: [{ id: "delivered", prompt: action.text, attachments: [file] }] },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().messages).toEqual([]);
  expect(session.getSnapshot().draft.text).toBe("Newer body");
  expect(session.getSnapshot().draft.recovered).toEqual([{ text: "Earlier recovery", attachments: [], values: {} }]);
});

test("queued receipt survives independent empty-queue and replaced canonical prompt events", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run(action);
  await session.run(action);
  session.accept({
    revision: 1,
    snapshot: { queuedFollowUps: [{ id: "first", prompt: action.text, attachments: [file] }] },
  });
  session.accept({ revision: 2, snapshot: { queuedFollowUps: [] } });
  expect(session.getSnapshot().pending).toHaveLength(1);
  const message = (id: string) => ({
    id,
    createdAt: 1234,
    role: "user" as const,
    parts: [
      { type: "text" as const, text: action.text },
      { type: "file" as const, fileId: file.id, filename: file.name, url: "" },
    ],
  });
  session.accept({ revision: 3, snapshot: { messages: [message("harness-first")] } });
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({ revision: 4, snapshot: { messages: [message("harness-replacement")] } });
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({
    revision: 5,
    snapshot: { queuedFollowUps: [{ id: "second", prompt: action.text, attachments: [file] }] },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("ordinary and queued input share one canonical acknowledgement owner", async () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { streaming: true, messages: [] } });
  await session.run(action);
  session.accept({
    revision: 2,
    snapshot: {
      messages: [
        {
          id: "first",
          role: "user",
          parts: [
            { type: "text", text: action.text },
            { type: "file", fileId: file.id, filename: file.name, url: "" },
          ],
        },
      ],
    },
  });
  expect(session.getSnapshot().pending).toHaveLength(1);
  expect(session.getSnapshot().pending?.[0]?.queue).toBe(true);
  session.accept({
    revision: 3,
    snapshot: { queuedFollowUps: [{ id: "second", prompt: action.text, attachments: [file] }] },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("an acknowledged queue receipt cannot steal the earlier ordinary input's delayed echo", async () => {
  const session = createChatSession({ query: async () => ({}), action: async () => ({}) });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { streaming: true, messages: [] } });
  await session.run(action);
  session.accept({
    revision: 2,
    snapshot: { queuedFollowUps: [{ id: "later-queue", prompt: action.text, attachments: [file] }] },
  });
  expect(session.getSnapshot().pending).toHaveLength(1);
  expect(session.getSnapshot().pending?.[0]?.queue).toBe(false);
  session.accept({
    revision: 3,
    snapshot: {
      messages: [
        {
          id: "earlier-ordinary",
          role: "user",
          parts: [
            { type: "text", text: action.text },
            { type: "file", fileId: file.id, filename: file.name, url: "" },
          ],
        },
      ],
    },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("identical failed inputs share recovery until their last acknowledgement without deleting prior saved work", async () => {
  for (const preexisting of [false, true]) {
    const failed = { text: action.text, attachments: action.attachments, values: action.values };
    const session = createChatSession({
      initial: { streaming: true },
      query: async () => ({}),
      action: async () => {
        throw new Error("Delivery uncertain");
      },
    });
    if (preexisting) session.changeDraft({ recovered: [failed] });
    await session.run(action).catch(() => {});
    await session.run(action).catch(() => {});
    expect(session.getSnapshot().draft.recovered).toHaveLength(1);
    const first = { id: "one", prompt: action.text, attachments: action.attachments };
    session.accept({ revision: 1, snapshot: { queuedFollowUps: [first] } });
    expect(session.getSnapshot().pending).toHaveLength(1);
    expect(session.getSnapshot().draft.recovered).toHaveLength(1);
    session.accept({ revision: 2, snapshot: { queuedFollowUps: [first, { ...first, id: "two" }] } });
    expect(session.getSnapshot().pending).toBeUndefined();
    expect(session.getSnapshot().draft.recovered ?? []).toHaveLength(preexisting ? 1 : 0);
  }
});
