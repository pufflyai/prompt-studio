import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import { createChatSession } from "./chat-session";

const failed = { text: "/fail", attachments: [], values: { model: "saved" } };
const acceptedSession = async () => {
  const session = createChatSession({
    query: async () => ({}),
    action: async () => ({ snapshot: { sentTag: null } }),
  });
  session.changeDraft(failed);
  await session.run({ type: "submit", ...failed });
  return session;
};

for (const [name, update] of [
  ["empty text", { text: "" }],
  ["empty attachments", { attachments: [] }],
  ["unchanged controls", { values: { model: "saved" } }],
] satisfies [string, Partial<ChatDraft>][]) {
  test(`native failure restores the composer after an unchanged write of ${name}`, async () => {
    const session = await acceptedSession();
    session.changeDraft(update);
    session.accept({ revision: 0, recoverDraft: failed });
    expect(session.getSnapshot().draft).toEqual(failed);
  });
}

test("native recovery keeps newer controls even when the composer text is empty", async () => {
  const session = await acceptedSession();
  session.changeDraft({ values: { model: "newer" } });
  session.accept({ revision: 0, recoverDraft: failed });
  expect(session.getSnapshot().draft).toEqual({
    text: "",
    attachments: [],
    values: { model: "newer" },
    recovered: [failed],
  });
});
