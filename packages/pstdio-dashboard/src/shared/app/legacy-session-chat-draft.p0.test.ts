import { expect, test } from "bun:test";
import { readLegacySessionChatDraft } from "./legacy-session-chat-draft";

test("legacy draft transfer scopes text and files to project and identity and acknowledges only unchanged sources", () => {
  const textKey = "dashboard-wb2:session-drafts:one";
  const filesKey = "dashboard-wb2:session-attachments:one:session";
  const files = [
    {
      file_id: "file",
      name: "image.png",
      mime_type: "image/png",
      size_bytes: 12,
      hash: null,
      url: "/file",
      created_at: "",
      updated_at: "",
    },
  ];
  const values = new Map([
    [textKey, JSON.stringify({ session: "Unsent", other: "Other" })],
    [filesKey, JSON.stringify(files)],
    ["dashboard-wb2:session-drafts:two", JSON.stringify({ session: "Foreign" })],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const first = readLegacySessionChatDraft("one", "session", storage)!;
  expect(first.draft).toMatchObject({
    text: "Unsent",
    attachments: [{ id: "file", name: "image.png", mediaType: "image/png" }],
  });
  expect(readLegacySessionChatDraft("one", "missing", storage)).toBeUndefined();
  storage.setItem(textKey, JSON.stringify({ session: "Typed during transfer", other: "Other" }));
  first.acknowledge();
  expect(JSON.parse(storage.getItem(textKey)!)).toEqual({ session: "Typed during transfer", other: "Other" });
  expect(JSON.parse(storage.getItem(filesKey)!)).toEqual(files);
  const recovery = readLegacySessionChatDraft("one", "session", storage)!;
  expect(recovery.draft).toMatchObject({
    text: "Typed during transfer",
    attachments: [{ id: "file", name: "image.png" }],
  });
  recovery.acknowledge();
  expect(storage.getItem(filesKey)).toBeNull();
  expect(readLegacySessionChatDraft("two", "session", storage)?.draft.text).toBe("Foreign");
});
