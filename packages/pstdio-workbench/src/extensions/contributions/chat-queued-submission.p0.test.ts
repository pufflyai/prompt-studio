import { expect, test } from "bun:test";
import { visibleChatDraftAttachments } from "./chat-pending-submission";
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

test("a send queued while the chat was idle leaves the transcript when its queue row arrives", async () => {
  const held = deferred();
  const session = createChatSession({
    initial: { streaming: false },
    query: async () => ({}),
    action: async (command) => {
      if (command.type === "queue") return { snapshot: { queuedFollowUps: [] } };
      return {};
    },
  });
  const queued = { id: "saved", prompt: action.text, attachments: [file] };
  const sent = session.run(action, () => held.promise);
  expect(session.getSnapshot().messages[0]?.role).toBe("user");
  session.accept({ revision: 1, snapshot: { streaming: true, queuedFollowUps: [queued] } });
  expect(session.getSnapshot().messages).toEqual([]);
  expect(session.getSnapshot().queuedFollowUps).toEqual([queued]);
  held.resolve({});
  await sent;
  await session.run({ type: "queue", operation: "remove", item: queued, values: {}, attachments: [] });
  await session.run({ type: "stop" });
  session.accept({ revision: 2, snapshot: { streaming: false, queuedFollowUps: [] } });
  await session.run({ ...action, text: "New message", attachments: [] });
  const next = { id: "next", role: "user" as const, parts: [{ type: "text" as const, text: "New message" }] };
  session.accept({ revision: 3, snapshot: { messages: [next] } });
  expect(session.getSnapshot().messages).toMatchObject([next]);
  expect(session.getSnapshot().queuedFollowUps).toEqual([]);
  expect(session.getSnapshot().pending).toBeUndefined();
});

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

test("a rejected queued send returns to the composer and leaves it if it arrives later", async () => {
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
  // The composer clears its text on send but still holds the sent file.
  session.changeDraft({ text: "", attachments: [file], values: action.values });
  await expect(session.run(action)).rejects.toThrow("Could not send");
  expect(session.getSnapshot().draft).toEqual({ text: action.text, attachments: [file], values: action.values });
  expect(session.getSnapshot().pending?.[0]?.failure).toBe("Could not send");
  expect(session.getSnapshot().messages).toMatchObject([{ role: "user", delivery: "unsent" }]);
  await session.flushDraft();
  expect(saved.at(-1)).toEqual(session.getSnapshot().draft);
  session.accept({
    revision: 1,
    snapshot: { queuedFollowUps: [{ id: "delivered", prompt: action.text, attachments: [file] }] },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
  expect(session.getSnapshot().draft).toMatchObject({ text: "", attachments: [] });
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

test("late delivery never offers delivered input for resubmission and keeps newer typing", async () => {
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

test("a repeated failed send keeps one receipt, which a late delivery still claims", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => {
      throw new Error("Delivery uncertain");
    },
  });
  await session.run(action).catch(() => {});
  await session.run(action).catch(() => {});
  expect(session.getSnapshot().pending).toHaveLength(1);
  session.accept({
    revision: 1,
    snapshot: { queuedFollowUps: [{ id: "one", prompt: action.text, attachments: action.attachments }] },
  });
  expect(session.getSnapshot().pending).toBeUndefined();
});

test("dismissing an unsent message keeps the composer and shows its files", async () => {
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => {
      throw new Error("Could not send");
    },
  });
  session.changeDraft({ attachments: [file] });
  await expect(session.run(action)).rejects.toThrow("Could not send");
  const unrelated = { id: "file-B", name: "B.txt" };
  session.changeDraft({ text: "Keep typing", attachments: [file, unrelated] });
  const { draft, pending } = session.getSnapshot();
  // The failed input's file is back in the composer, so nothing stays hidden.
  expect(visibleChatDraftAttachments(draft.attachments, pending)).toEqual([file, unrelated]);
  session.dismissSubmission(session.getSnapshot().pending![0]!.message.id);
  const dismissed = session.getSnapshot();
  expect(dismissed.pending?.[0]?.failureDismissed).toBe(true);
  expect(dismissed.draft).toEqual(draft);
  expect(visibleChatDraftAttachments(dismissed.draft.attachments, dismissed.pending)).toEqual([file, unrelated]);
});

test("sending a returned message again replaces its failed copy", async () => {
  let fail = true;
  const session = createChatSession({
    initial: { streaming: true },
    query: async () => ({}),
    action: async () => {
      if (fail) throw new Error("Could not send");
      return {};
    },
  });
  await expect(session.run(action)).rejects.toThrow("Could not send");
  expect(session.getSnapshot().pending?.filter((item) => item.failure)).toHaveLength(1);
  fail = false;
  await session.run(action);
  expect(session.getSnapshot().pending?.some((item) => item.failure)).toBeFalsy();
});
