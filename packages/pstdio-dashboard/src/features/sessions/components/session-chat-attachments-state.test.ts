import { describe, expect, test } from "bun:test";
import type { SessionChatDraftAttachment } from "./session-chat-attachments";
import { appendDraftAttachments, clearDraftAttachments, removeDraftAttachment } from "./session-chat-attachments-state";

const buildAttachment = (id: string, previewUrl: string): SessionChatDraftAttachment => ({
  upload: {
    id,
    file_name: `${id}.png`,
    mime_type: "image/png",
    size_bytes: 10,
  },
  previewUrl,
});

describe("session chat attachment state", () => {
  test("does not revoke previous previews when adding more attachments", () => {
    const revoked: string[] = [];
    const first = buildAttachment("a-1", "blob:first");
    const second = buildAttachment("a-2", "blob:second");

    let state: SessionChatDraftAttachment[] = [];
    state = appendDraftAttachments(state, [first]);
    state = appendDraftAttachments(state, [second]);

    expect(state.map((item) => item.upload.id)).toEqual(["a-1", "a-2"]);
    expect(revoked).toEqual([]);
  });

  test("revokes only removed attachment preview", () => {
    const revoked: string[] = [];
    const state = [buildAttachment("a-1", "blob:first"), buildAttachment("a-2", "blob:second")];

    const next = removeDraftAttachment(state, "a-2", (url) => revoked.push(url));

    expect(next.map((item) => item.upload.id)).toEqual(["a-1"]);
    expect(revoked).toEqual(["blob:second"]);
  });

  test("revokes all previews when clearing", () => {
    const revoked: string[] = [];
    const state = [buildAttachment("a-1", "blob:first"), buildAttachment("a-2", "blob:second")];

    const next = clearDraftAttachments(state, (url) => revoked.push(url));

    expect(next).toEqual([]);
    expect(revoked).toEqual(["blob:first", "blob:second"]);
  });
});
