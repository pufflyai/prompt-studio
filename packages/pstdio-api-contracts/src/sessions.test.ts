import { describe, expect, test } from "bun:test";
import { createSessionInputSchema, followUpInputSchema, sessionPromptAttachmentSchema } from "./sessions";

describe("sessionPromptAttachmentSchema", () => {
  test("validates attachment metadata for session prompts", () => {
    const attachment = {
      id: "file_123",
      file_name: "image.png",
      mime_type: "image/png",
      size_bytes: 1234,
    };

    expect(sessionPromptAttachmentSchema.parse(attachment)).toEqual(attachment);
  });
});

describe("session attachments in request schemas", () => {
  test("accepts attachments on create-session input", () => {
    const parsed = createSessionInputSchema.parse({
      project_id: "project_1",
      title: "Session",
      prompt: "Describe this image",
      attachments: [
        {
          id: "file_123",
          file_name: "image.png",
          mime_type: "image/png",
          size_bytes: 1234,
        },
      ],
    });

    expect(parsed.attachments).toHaveLength(1);
  });

  test("rejects invalid attachment metadata on follow-up input", () => {
    const result = followUpInputSchema.safeParse({
      prompt: "follow up",
      attachments: [{ id: "file_123", file_name: "", mime_type: "image/png", size_bytes: -1 }],
    });

    expect(result.success).toBe(false);
  });
});
