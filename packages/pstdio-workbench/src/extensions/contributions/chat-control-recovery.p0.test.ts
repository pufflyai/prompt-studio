import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import { createChatSession } from "./chat-session";

const failed = { text: "/fail", attachments: [], values: { model: "A" } };

test("automatic control defaults cannot demote an acknowledged failed command to a saved recovery", async () => {
  const earlier = { text: "Earlier work", attachments: [], values: {} };
  const session = createChatSession({
    initial: { values: failed.values },
    query: async () => ({}),
    action: async () => ({ snapshot: { sentTag: null } }),
  });
  session.changeDraft({ ...failed, recovered: [earlier] });
  await session.run({ type: "submit", ...failed });
  session.accept({ revision: 0, snapshot: { values: { model: "B" } } });
  session.accept({ revision: 1, recoverDraft: failed });
  expect(session.getSnapshot().draft).toEqual({ ...failed, recovered: [earlier] });
});

test("a newer explicit control choice keeps its draft when the previous native command fails", async () => {
  const session = createChatSession({
    initial: { values: failed.values },
    query: async () => ({}),
    action: async () => ({ snapshot: { sentTag: null } }),
  });
  session.changeDraft(failed);
  await session.run({ type: "submit", ...failed });
  session.changeDraft({ values: { model: "C" } });
  session.accept({ revision: 0, snapshot: { values: { model: "B" } } });
  session.accept({ revision: 1, recoverDraft: failed });
  expect(session.getSnapshot().draft).toEqual({
    text: "",
    attachments: [],
    values: { model: "C" },
    recovered: [failed],
  });
});

test("late empty hydration keeps a submitted body's recovery in the editor", async () => {
  const loaded = Promise.withResolvers<ChatDraft>();
  const session = createChatSession({
    initial: { values: failed.values },
    query: async () => ({}),
    loadDraft: () => loaded.promise,
    action: async () => ({ snapshot: { sentTag: null } }),
  });
  const release = session.retain();
  try {
    session.changeDraft(failed);
    await session.run({ type: "submit", ...failed });
    loaded.resolve({ text: "", attachments: [], values: {} });
    await new Promise<void>((resolve) => setImmediate(resolve));
    session.accept({ revision: 0, snapshot: { values: { model: "B" } } });
    session.accept({ revision: 1, recoverDraft: failed });
    expect(session.getSnapshot().draft).toMatchObject(failed);
    expect(session.getSnapshot().draft.recovered ?? []).toEqual([]);
  } finally {
    release();
    await session.dispose();
  }
});
