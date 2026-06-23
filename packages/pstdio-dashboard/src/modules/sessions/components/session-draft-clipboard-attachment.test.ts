import { describe, expect, test } from "bun:test";
import { createClipboardAttachmentFile } from "./session-draft-clipboard-attachment";

describe("createClipboardAttachmentFile", () => {
  test("uses a short sequential text file name", async () => {
    const file = createClipboardAttachmentFile("hello", 1);

    expect(file.name).toBe("clipboard-1.txt");
    expect(file.type).toStartWith("text/plain");
    expect(await file.text()).toBe("hello");
  });
});
