import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import type { WorkbenchStorageLike } from "../../storage/local-storage-persistence-helpers";
import { createLocalChatDraft, seedLocalChatDraft } from "./chat-local-drafts";
import { createChatSession } from "./chat-session";

const draft: ChatDraft = {
  text: "Half-written reply",
  attachments: [{ id: "notes", name: "notes.txt" }],
  values: { harness: { harnessId: "agent", model: "chosen" } },
};

const createStorage = () => {
  const records = new Map<string, string>();
  const writes: string[] = [];
  const storage: WorkbenchStorageLike = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      records.set(key, value);
    },
    removeItem: (key) => {
      records.delete(key);
    },
  };
  return { records, writes, storage };
};

const openSession = () => createChatSession({ query: async () => ({}), action: async () => undefined });

test("each conversation keeps its own draft across a reload", () => {
  const { storage } = createStorage();
  const first = createLocalChatDraft("conversation-a", storage);
  const second = createLocalChatDraft("conversation-b", storage);
  first.save(draft);
  second.save({ ...draft, text: "Other conversation" });
  first.dispose();
  second.dispose();

  expect(createLocalChatDraft("conversation-a", storage).read()).toEqual(draft);
  expect(createLocalChatDraft("conversation-b", storage).read()?.text).toBe("Other conversation");
  expect(createLocalChatDraft("conversation-c", storage).read()).toBeUndefined();
});

test("typing is written after a pause instead of on every keystroke", () => {
  const { storage, writes } = createStorage();
  const local = createLocalChatDraft("conversation", storage);
  local.save({ ...draft, text: "H" });
  local.save({ ...draft, text: "Ha" });
  local.save(draft);

  expect(writes).toEqual([]);
  expect(local.read()).toEqual(draft);
  local.flush();
  expect(writes).toEqual(["pstdio-workbench:chat-draft:conversation"]);
  local.dispose();
});

test("an emptied draft is removed from storage", () => {
  const { storage, records } = createStorage();
  const local = createLocalChatDraft("conversation", storage);
  local.save(draft);
  local.flush();
  local.save({ text: "", attachments: [], values: {} });
  local.dispose();

  expect(records.size).toBe(0);
});

test("a draft saved by an older release keeps its text and drops its restore list", () => {
  const { storage, records } = createStorage();
  records.set(
    "pstdio-workbench:chat-draft:conversation",
    JSON.stringify({ ...draft, recovered: [{ text: "Older copy", attachments: [], values: {} }] }),
  );
  records.set("pstdio-workbench:chat-draft:broken", "{");

  expect(createLocalChatDraft("conversation", storage).read()).toEqual(draft);
  expect(createLocalChatDraft("broken", storage).read()).toBeUndefined();
});

test("a stored draft fills an untouched composer but never replaces typing", () => {
  const session = openSession();
  try {
    session.storedDraft.restore(draft);
    expect(session.getSnapshot().draft).toEqual(draft);
    session.changeDraft({ text: "Typed now" });
    session.storedDraft.restore({ ...draft, text: "Late stored copy" });
    expect(session.getSnapshot().draft.text).toBe("Typed now");
  } finally {
    session.dispose();
  }
});

test("restored controls keep their saved values when host defaults change", () => {
  const session = createChatSession({
    initial: { values: draft.values },
    query: async () => ({}),
    action: async () => undefined,
  });
  try {
    session.storedDraft.restore(draft);
    session.accept({ revision: 1, snapshot: { values: { harness: { harnessId: "agent", model: "new-default" } } } });
    expect(session.getSnapshot().draft.values).toEqual(draft.values);
  } finally {
    session.dispose();
  }
});

test("a seeded draft opens in its new conversation and cannot overwrite an existing draft", () => {
  const { storage, records } = createStorage();
  const discard = seedLocalChatDraft("unopened", draft, storage);
  discard();
  expect(records.has("pstdio-workbench:chat-draft:unopened")).toBe(false);

  seedLocalChatDraft("new-session", draft, storage);
  expect(() => seedLocalChatDraft("new-session", { ...draft, text: "Overwrite" }, storage)).toThrow(
    "already has a draft",
  );
  expect(createLocalChatDraft("new-session", storage).read()).toEqual(draft);
});
