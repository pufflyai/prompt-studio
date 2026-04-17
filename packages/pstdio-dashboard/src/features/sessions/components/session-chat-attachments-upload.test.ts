import { describe, expect, test } from "bun:test";
import { uploadSessionChatAttachments } from "./session-chat-attachments-upload";

const createFile = (name: string, type: string) => new File([`content:${name}`], name, { type });

describe("uploadSessionChatAttachments", () => {
  test("keeps successfully uploaded files when a later file fails", async () => {
    const first = createFile("first.png", "image/png");
    const second = createFile("second.png", "image/png");

    const result = await uploadSessionChatAttachments(
      "project-1",
      [
        { file: first, base64: "Zmlyc3Q=" },
        { file: second, base64: "c2Vjb25k" },
      ],
      {
        uploadAttachment: async ({ fileName }) => {
          if (fileName === "second.png") {
            throw new Error("upload failed");
          }

          return {
            id: `id-${fileName}`,
            file_name: fileName,
            mime_type: "image/png",
            size_bytes: 16,
          };
        },
        createPreviewUrl: (file) => `blob:${file.name}`,
      },
    );

    expect(result).toEqual({
      uploaded: [
        {
          upload: {
            id: "id-first.png",
            file_name: "first.png",
            mime_type: "image/png",
            size_bytes: 16,
          },
          previewUrl: "blob:first.png",
        },
      ],
      failed: [{ fileName: "second.png", errorMessage: "upload failed" }],
    });
  });
});
