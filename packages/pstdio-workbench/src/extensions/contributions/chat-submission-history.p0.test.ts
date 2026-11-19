import { expect, test } from "bun:test";
import { createChatSession } from "./chat-session";

const user = (id: string, text: string) => ({ id, role: "user" as const, parts: [{ type: "text" as const, text }] });
const action = { type: "submit" as const, text: "Follow-up", attachments: [], values: {} };
const prompts = (session: ReturnType<typeof createChatSession>) => {
  const state = session.getSnapshot();
  return (state.historyMessages ?? state.messages)
    .filter((message) => message.role === "user")
    .map((message) => message.parts[0]);
};

test("removing a queued message releases its receipt before another send with the same text", async () => {
  const queued = { id: "removed", prompt: action.text };
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async (command) => (command.type === "queue" ? { snapshot: { queuedFollowUps: [] } } : {}),
  });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [queued] } });
  await session.run({ type: "queue", operation: "remove", item: queued, values: {}, attachments: [] });
  expect(prompts(session)).toEqual([]);
  await session.run({ type: "stop" });
  session.accept({ revision: 2, snapshot: { streaming: false } });
  await session.run(action);
  const delivered = user("delivered", action.text);
  session.accept({ revision: 3, snapshot: { messages: [delivered] } });
  expect(session.getSnapshot().messages).toMatchObject([delivered]);
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("an accepted follow-up is recallable before queue or canonical echo when the visible run is still streaming", async () => {
  const first = user("first", "First prompt");
  const session = createChatSession({
    initial: { streaming: true, messages: [first] },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run(action);
  expect(session.getSnapshot().conversation.messages).toEqual([first]);
  expect(session.getSnapshot().messages).toMatchObject([first]);
  expect(session.getSnapshot().queuedFollowUps).toMatchObject([{ prompt: action.text }]);
  const history = [first.parts[0], { type: "text" as const, text: action.text }];
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [{ id: "receipt", prompt: action.text }] } });
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 2, snapshot: { queuedFollowUps: [] } });
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 3, snapshot: { messages: [first, user("canonical", action.text)] } });
  expect(prompts(session)).toEqual(history);
});

test("queue priority changes and overlapping canonical receipts do not duplicate or reorder submitted history", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [{ id: "one", prompt: action.text }] } });
  await session.run({ ...action, text: "Newer" });
  session.accept({
    revision: 2,
    snapshot: {
      queuedFollowUps: [
        { id: "two", prompt: "Newer" },
        { id: "one", prompt: action.text },
      ],
    },
  });
  const history = [
    { type: "text" as const, text: action.text },
    { type: "text" as const, text: "Newer" },
  ];
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 3, snapshot: { messages: [user("canonical", action.text)] } });
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 4, snapshot: { queuedFollowUps: [] } });
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 5, snapshot: { messages: [user("canonical", action.text), user("newer", "Newer")] } });
  expect(prompts(session)).toEqual(history);
});

test("a newer canonical send remains newest while an older queued receipt arrives later", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [{ id: "one", prompt: action.text }] } });
  await session.run({ ...action, text: "Newer" });
  session.accept({
    revision: 2,
    snapshot: {
      queuedFollowUps: [
        { id: "one", prompt: action.text },
        { id: "two", prompt: "Newer" },
      ],
      messages: [user("newer", "Newer")],
    },
  });
  const history = [
    { type: "text" as const, text: action.text },
    { type: "text" as const, text: "Newer" },
  ];
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 3, snapshot: { queuedFollowUps: [] } });
  expect(prompts(session)).toEqual(history);
  session.accept({ revision: 4, snapshot: { messages: [user("newer", "Newer"), user("late", action.text)] } });
  expect(prompts(session)).toEqual(history);
  const previous = session.getSnapshot().historyMessages;
  session.changeDraft({ text: "Unsent" });
  expect(session.getSnapshot().historyMessages).toBe(previous);
});

test("repeated identical accepted inputs remain distinct and question replies do not enter history", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run(action);
  await session.run(action);
  const history = [
    { type: "text" as const, text: action.text },
    { type: "text" as const, text: action.text },
  ];
  expect(prompts(session)).toEqual(history);
  session.accept({
    revision: 1,
    snapshot: { queuedFollowUps: [{ id: "one", prompt: action.text }], messages: [user("first", action.text)] },
  });
  expect(prompts(session)).toEqual(history);
  await session.run({ ...action, text: "Answer", questionResponse: { callId: "question", answers: [["Yes"]] } });
  expect(prompts(session)).toEqual(history);
});

test("unaccepted and rejected queued input does not become recalled history", async () => {
  let reject!: (error: Error) => void;
  const held = new Promise((_, fail) => {
    reject = fail;
  });
  const session = createChatSession({ initial: { streaming: true }, query: async () => ({}), action: () => held });
  const sending = session.run(action);
  expect(prompts(session)).toEqual([]);
  reject(new Error("Not accepted"));
  await expect(sending).rejects.toThrow("Not accepted");
  expect(prompts(session)).toEqual([]);
});

for (const acknowledged of [true, false]) {
  test(`Stop releases canceled queued input before an identical resend (acknowledged=${acknowledged})`, async () => {
    const session = createChatSession({
      initial: { streaming: true },
      query: async () => ({}),
      action: async (command) =>
        command.type === "stop" ? { snapshot: { streaming: false, queuedFollowUps: [] } } : {},
    });
    await session.run(action);
    if (acknowledged)
      session.accept({ revision: 1, snapshot: { queuedFollowUps: [{ id: "old", prompt: action.text }] } });
    await session.run({ type: "stop" });
    await session.run(action);
    const delivered = user("new", action.text);
    session.accept({ revision: 2, snapshot: { messages: [delivered] } });
    expect(session.getSnapshot().messages).toMatchObject([delivered]);
    expect(session.getSnapshot().pending).toBeUndefined();
  });
}

test("a delayed Stop acknowledgement preserves follow-ups sent after it started", async () => {
  const stopped = Promise.withResolvers<unknown>();
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async (command) => (command.type === "stop" ? stopped.promise : {}),
  });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [{ id: "old", prompt: action.text }] } });
  const stop = session.run({ type: "stop" });
  await session.run({ ...action, text: "Newer follow-up" });
  session.accept({ revision: 2, snapshot: { queuedFollowUps: [{ id: "new", prompt: "Newer follow-up" }] } });
  stopped.resolve({});
  await stop;
  expect(prompts(session)).toEqual([{ type: "text", text: "Newer follow-up" }]);
});

test("Stop also removes an old queued receipt arriving during its acknowledgement", async () => {
  const action = { type: "submit" as const, text: "Repeat", attachments: [], values: {} };
  const stopped = Promise.withResolvers<unknown>();
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async (command) => (command.type === "stop" ? stopped.promise : {}),
  });
  await session.run(action);
  const stopping = session.run({ type: "stop" });
  session.accept({ revision: 1, snapshot: { queuedFollowUps: [{ id: "old", prompt: action.text }] } });
  stopped.resolve({ snapshot: { streaming: false, queuedFollowUps: [] } });
  await stopping;
  await session.run(action);
  session.accept({
    revision: 2,
    snapshot: { messages: [{ id: "new", role: "user", parts: [{ type: "text", text: action.text }] }] },
  });
  expect(session.getSnapshot().messages).toHaveLength(1);
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("Stop retires a late queued acknowledgement for a send issued while idle", async () => {
  const stopped = Promise.withResolvers<unknown>();
  const session = createChatSession({
    initial: { streaming: false },
    query: async () => ({}),
    action: async (command) => (command.type === "stop" ? stopped.promise : {}),
  });
  await session.run(action);
  session.accept({ revision: 1, snapshot: { streaming: true } });
  const stopping = session.run({ type: "stop" });
  session.accept({ revision: 2, snapshot: { queuedFollowUps: [{ id: "old", prompt: action.text }] } });
  stopped.resolve({ snapshot: { streaming: false, queuedFollowUps: [] } });
  await stopping;
  session.accept({ revision: 3, snapshot: { streaming: false, queuedFollowUps: [] } });
  expect(prompts(session)).toEqual([]);
  await session.run(action);
  const delivered = user("new", action.text);
  session.accept({ revision: 4, snapshot: { messages: [delivered] } });
  expect(session.getSnapshot().messages).toMatchObject([delivered]);
  expect(session.getSnapshot().pending).toBeUndefined();
});
