import { expect, test } from "bun:test";
import type { SessionAttachment } from "pstdio-api-contracts";
import { createDashboardSessionDraftPersistence } from "./session-draft-persistence";

test("keeps attachment drafts with their project and conversation after the panel is recreated", () => {
  const values = new Map<string, string>();
  const input = {
    namespace: "attachment-drafts",
    projectSelection: { getSelectedProjectId: () => "project-a" },
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
  const file: SessionAttachment = {
    file_id: "file-b",
    name: "notes.txt",
    mime_type: "text/plain",
    size_bytes: 5,
    hash: null,
    url: "/content/file-b",
    created_at: "2026-10-06",
    updated_at: "2026-10-06",
  };
  const drafts = createDashboardSessionDraftPersistence(input);
  drafts.getAttachmentDraft("project-a", "session-b").changeAttachments(() => [file]);
  const restored = createDashboardSessionDraftPersistence(input);
  expect(restored.getAttachmentDraft("project-a", "session-a").getSnapshot().attachments).toEqual([]);
  expect(restored.getAttachmentDraft("project-b", "session-b").getSnapshot().attachments).toEqual([]);
  expect(restored.getAttachmentDraft("project-a", "session-b").getSnapshot().attachments).toEqual([file]);
  restored.getAttachmentDraft("project-a", "session-b").changeAttachments(() => []);
  expect(restored.getAttachmentDraft("project-a", "session-b").getSnapshot().attachments).toEqual([]);
});

test("shares pending uploads and merges late results into the current conversation", () => {
  const values = new Map<string, string>();
  const drafts = createDashboardSessionDraftPersistence({
    namespace: "draft-race",
    projectSelection: { getSelectedProjectId: () => "project" },
    storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  const original = drafts.getAttachmentDraft("project", "session-b");
  original.changeUploading(1);
  const remounted = drafts.getAttachmentDraft("project", "session-b");
  expect(remounted).toBe(original);
  expect(remounted.getSnapshot().uploading).toBe(true);
  let notifications = 0;
  const unsubscribe = remounted.subscribe(() => notifications++);
  const newer = { file_id: "newer" } as SessionAttachment;
  const late = { file_id: "late" } as SessionAttachment;
  remounted.changeAttachments(() => [newer]);
  original.changeAttachments((current) => [...current, late]);
  original.changeUploading(-1);
  expect(remounted.getSnapshot()).toEqual({ attachments: [newer, late], uploading: false });
  expect(notifications).toBe(3);
  unsubscribe();
});
