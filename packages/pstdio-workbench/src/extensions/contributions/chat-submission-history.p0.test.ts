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
