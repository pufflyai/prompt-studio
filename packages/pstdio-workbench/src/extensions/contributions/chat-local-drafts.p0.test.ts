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

test("a replaced view of the same conversation stops writing its draft", () => {
  const { storage } = createStorage();
  const old = createLocalChatDraft("conversation", storage);
  const replacement = createLocalChatDraft("conversation", storage);
  replacement.save(draft);
  old.save({ ...draft, text: "Stale typing" });
  expect(createLocalChatDraft("other", storage).read()).toBeUndefined();
  expect(replacement.read()).toEqual(draft);
});

test("a sent or emptied draft is removed even when it keeps control values", () => {
  const { storage, records } = createStorage();
  const local = createLocalChatDraft("conversation", storage);
  local.save(draft);
  local.save({ text: "", attachments: [], values: draft.values });
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

test("a provider draft saved by an older release still loads and keeps saving", async () => {
  const saved: ChatDraft[] = [];
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    loadDraft: async () => ({ ...draft, recovered: [{ text: "Older copy", attachments: [], values: {} }] }),
    saveDraft: async (next) => {
      saved.push(next);
    },
  });
  const release = session.retain();
  try {
    await new Promise((done) => setTimeout(done, 0));
    expect(session.getSnapshot().draft).toEqual(draft);
    session.changeDraft({ text: "Edited" });
    await session.flushDraft();
    expect(saved.at(-1)).toEqual({ ...draft, text: "Edited" });
  } finally {
    release();
    session.dispose();
  }
});
