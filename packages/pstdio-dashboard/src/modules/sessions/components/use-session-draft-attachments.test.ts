import { describe, expect, mock, test } from "bun:test";
import type { SessionAttachment } from "pstdio-api-contracts";
import {
  clearSubmittedDraftAttachments,
  removeDeletedDraftAttachment,
  resetDraftAttachmentsForProjectChange,
} from "./session-draft-attachment-state";
import { uploadDraftAttachmentFiles } from "./session-draft-attachment-upload";

const attachment = (fileId: string, name: string): SessionAttachment => ({
  file_id: fileId,
  name,
  mime_type: "text/plain",
  size_bytes: 5,
  hash: null,
  url: `/content/${fileId}`,
  created_at: "2026-06-17T00:00:00.000Z",
  updated_at: "2026-06-17T00:00:00.000Z",
});

describe("uploadDraftAttachmentFiles", () => {
  test("reports successful uploads before a later file upload fails", async () => {
    const uploaded: SessionAttachment[] = [];
    const uploadFile = mock(async (file: File) => {
      if (file.name === "second.txt") throw new Error("upload failed");
      return attachment("file-1", file.name);
    });

    await expect(
      uploadDraftAttachmentFiles({
        files: [
          new File(["first"], "first.txt", { type: "text/plain" }),
          new File(["second"], "second.txt", { type: "text/plain" }),
        ],
        onUploaded: (file) => uploaded.push(file),
        uploadFile,
      }),
    ).rejects.toThrow("upload failed");

    expect(uploaded).toEqual([attachment("file-1", "first.txt")]);
  });
});

describe("removeDeletedDraftAttachment", () => {
  test("keeps draft state when attachment delete fails", async () => {
    const attachments = [attachment("file-1", "first.txt")];
    const deleteAttachment = mock(async () => {
      throw new Error("delete failed");
    });

    await expect(
      removeDeletedDraftAttachment({
        attachments,
        deleteAttachment,
        fileId: "file-1",
        projectId: "project-1",
      }),
    ).rejects.toThrow("delete failed");

    expect(deleteAttachment).toHaveBeenCalledWith("project-1", "file-1");
  });

  test("removes draft state after attachment delete succeeds", async () => {
    const attachments = [attachment("file-1", "first.txt"), attachment("file-2", "second.txt")];
    const deleteAttachment = mock(async () => {});

    await expect(
      removeDeletedDraftAttachment({
        attachments,
        deleteAttachment,
        fileId: "file-1",
        projectId: "project-1",
      }),
    ).resolves.toEqual([attachment("file-2", "second.txt")]);
  });
});

describe("resetDraftAttachmentsForProjectChange", () => {
  test("cleans old project attachments and clears state when project changes", () => {
    const attachments = [attachment("file-1", "first.txt"), attachment("file-2", "second.txt")];
    const deleteAttachment = mock(async () => {});

    const next = resetDraftAttachmentsForProjectChange({
      attachments,
      deleteAttachment,
      nextProjectId: "project-2",
      previousProjectId: "project-1",
    });

    expect(next).toEqual([]);
    expect(deleteAttachment).toHaveBeenCalledWith("project-1", "file-1");
    expect(deleteAttachment).toHaveBeenCalledWith("project-1", "file-2");
  });

  test("keeps draft state when the project is unchanged", () => {
    const attachments = [attachment("file-1", "first.txt")];
    const deleteAttachment = mock(async () => {});

    expect(
      resetDraftAttachmentsForProjectChange({
        attachments,
        deleteAttachment,
        nextProjectId: "project-1",
        previousProjectId: "project-1",
      }),
    ).toEqual(attachments);
    expect(deleteAttachment).not.toHaveBeenCalled();
  });
});

describe("clearSubmittedDraftAttachments", () => {
  test("clears the cleanup ref synchronously before unmount cleanup can run", () => {
    const attachments = [attachment("file-1", "first.txt")];
    const attachmentsRef = { current: attachments };
    const setAttachments = mock(() => undefined);

    clearSubmittedDraftAttachments({ attachmentsRef, setAttachments });

    expect(attachmentsRef.current).toEqual([]);
    expect(setAttachments).toHaveBeenCalledWith([]);
  });
});
