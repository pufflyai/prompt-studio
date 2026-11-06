import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import { createChatSession } from "./chat-session";

test("typing while provider draft hydration is pending stages unsent work before an asynchronous save can start", () => {
  const staged: ChatDraft[] = [];
  const saved: ChatDraft[] = [];
  const session = createChatSession({
    query: async () => ({}),
    loadDraft: () => new Promise(() => {}),
    saveDraft: async (draft) => {
      saved.push(draft);
    },
    stageDraft: (draft) => {
      staged.push(structuredClone(draft));
    },
    action: async () => undefined,
  });
  const release = session.retain();
  const draft = {
    text: "Keep new work across reload",
    attachments: [{ id: "uploaded", name: "notes.txt" }],
    values: { provider: { harnessId: "fixture", model: "saved-model" }, workspace: "workspace" },
  };
  session.changeDraft(draft);
  expect(staged).toEqual([draft]);
  expect(saved).toEqual([]);
  release();
});

const memoryStorage = () => {
  const records = new Map<string, string>();
  return {
    get length() {
      return records.size;
    },
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      records.set(key, value);
    },
    removeItem: (key: string) => {
      records.delete(key);
    },
  };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const empty = (): ChatDraft => ({ text: "", attachments: [], values: {} });

import { createChatDraftPersistence } from "./chat-draft-persistence";

test("a new document restores unacknowledged text, files and settings; an old acknowledgement cannot clear newer recovery", async () => {
  const storage = memoryStorage();
  let provider: ChatDraft = {
    text: "Earlier saved work",
    attachments: [{ id: "earlier", name: "earlier.txt" }],
    values: {},
  };
  const writes: { draft: ChatDraft; acknowledge(): void }[] = [];
  const open = () => {
    const persistence = createChatDraftPersistence({
      storage,
      key: "project/view/session",
      load: async () => structuredClone(provider),
      save: (draft) =>
        new Promise((resolve) => {
          writes.push({
            draft: structuredClone(draft),
            acknowledge() {
              provider = structuredClone(draft);
              resolve(undefined);
            },
          });
        }),
    });
    const session = createChatSession({
      ...persistence,
      query: async () => ({ values: { provider: { harnessId: "default", model: "query" } } }),
      action: async () => undefined,
    });
    persistence.restore(session);
    return session;
  };
  const first = open();
  const releaseFirst = first.retain();
  await tick();
  const draft: ChatDraft = {
    text: "Newer unsent work",
    attachments: [{ id: "uploaded", name: "notes.txt" }],
    values: { provider: { harnessId: "fixture", model: "chosen" } },
  };
  first.changeDraft(draft);
  await tick();
  expect(writes).toHaveLength(1);
  releaseFirst();
  first.dispose();
  const second = open();
  expect(second.getSnapshot().draft).toEqual(draft);
  const releaseSecond = second.retain();
  await tick();
  expect(writes).toHaveLength(1);
  expect(second.getSnapshot().draft).toMatchObject({
    ...draft,
    recovered: [{ text: "Earlier saved work", attachments: [{ id: "earlier", name: "earlier.txt" }] }],
  });
  writes[0]!.acknowledge();
  await first.flushDraft();
  await tick();
  expect(writes).toHaveLength(2);
  const third = open();
  expect(third.getSnapshot().draft).toEqual(second.getSnapshot().draft);
  third.dispose();
  writes[1]!.acknowledge();
  await second.flushDraft();
  expect(storage.length).toBe(0);
  releaseSecond();
  second.dispose();
  const last = open();
  expect(last.getSnapshot().draft.text).toBe("");
  const releaseLast = last.retain();
  await tick();
  expect(last.getSnapshot().draft).toEqual(provider);
  expect(provider.text).toBe(draft.text);
  releaseLast();
  last.dispose();
});

test("a rejected save leaves its pending draft recoverable in its exact project/view/resource scope", async () => {
  const storage = memoryStorage();
  const persistence = (key: string) =>
    createChatDraftPersistence({
      storage,
      key,
      load: async () => empty(),
      save: async () => {
        throw new Error("Offline save");
      },
    });
  const firstDrafts = persistence("project-a/view-a/session-a");
  const first = createChatSession({ ...firstDrafts, query: async () => ({}), action: async () => undefined });
  const release = first.retain();
  await tick();
  first.changeDraft({ text: "Keep offline", attachments: [{ id: "file", name: "offline.txt" }] });
  await first.flushDraft();
  expect(first.getSnapshot().error).toBe("Offline save");
  release();
  first.dispose();
  for (const key of ["project-b/view-a/session-a", "project-a/view-b/session-a", "project-a/view-a/draft"]) {
    const foreign = createChatSession({ query: async () => ({}), action: async () => undefined });
    persistence(key).restore(foreign);
    expect(foreign.getSnapshot().draft.text).toBe("");
    foreign.dispose();
  }
  const restored = createChatSession({ query: async () => ({}), action: async () => undefined });
  persistence("project-a/view-a/session-a").restore(restored);
  expect(restored.getSnapshot().draft).toMatchObject({
    text: "Keep offline",
    attachments: [{ id: "file", name: "offline.txt" }],
  });
  restored.dispose();
});

test("a replaced owner cannot save over its replacement when its earlier hydration finishes late", async () => {
  const storage = memoryStorage();
  const delayed = Promise.withResolvers<ChatDraft>();
  let provider = empty();
  const open = (load: () => Promise<ChatDraft>) => {
    const drafts = createChatDraftPersistence({
      key: "project/view/session",
      storage,
      load,
      save: async (draft) => {
        provider = structuredClone(draft);
      },
    });
    const session = createChatSession({ ...drafts, query: async () => ({}), action: async () => undefined });
    drafts.restore(session);
    return session;
  };
  const first = open(() => delayed.promise);
  const releaseFirst = first.retain();
  first.changeDraft({ text: "Old document" });
  releaseFirst();
  first.dispose();
  const replacement = open(async () => empty());
  const releaseReplacement = replacement.retain();
  const newer = { text: "New document", attachments: [{ id: "new", name: "new.txt" }], values: { model: "new" } };
  replacement.changeDraft(newer);
  await replacement.flushDraft();
  expect(provider).toMatchObject(newer);
  delayed.resolve(empty());
  await first.flushDraft();
  expect(provider).toMatchObject(newer);
  expect(storage.length).toBe(0);
  releaseReplacement();
  replacement.dispose();
});

test("disposing an idle replacement preserves ordering behind an older owner write already in flight", async () => {
  const storage = memoryStorage();
  const acknowledge = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  let provider = empty();
  const first = createChatDraftPersistence({
    key: "project/view/session",
    storage,
    save: async (draft) => {
      entered.resolve();
      await acknowledge.promise;
      provider = structuredClone(draft);
    },
  });
  first.stageDraft({ ...empty(), text: "Old document" });
  const oldSave = first.saveDraft({ ...empty(), text: "Old document" });
  await entered.promise;
  const idle = createChatDraftPersistence({ key: "project/view/session", storage, save: async () => undefined });
  idle.dispose();
  const second = createChatDraftPersistence({
    key: "project/view/session",
    storage,
    save: async (draft) => {
      provider = structuredClone(draft);
    },
  });
  const newer = { ...empty(), text: "New document" };
  second.stageDraft(newer);
  const newSave = second.saveDraft(newer);
  let saved = false;
  void newSave.then(() => {
    saved = true;
  });
  await tick();
  expect(saved).toBe(false);
  acknowledge.resolve();
  await Promise.all([oldSave, newSave]);
  expect(provider).toEqual(newer);
  expect(storage.length).toBe(0);
});
