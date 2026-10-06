import { describe, expect, mock, test } from "bun:test";
import type { SessionAttachment } from "pstdio-api-contracts";
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
