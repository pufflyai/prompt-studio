import { describe, expect, test } from "bun:test";
import { isImageAttachment } from "./is-image-attachment";

describe("isImageAttachment", () => {
  test("treats any image mime type as an image", () => {
    expect(isImageAttachment({ name: "diagram", mimeType: "image/png" })).toBe(true);
    expect(isImageAttachment({ name: "scan", mimeType: "image/heic" })).toBe(true);
  });

  test("falls back to known image extensions when the mime type is missing", () => {
    for (const name of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp", "f.svg"]) {
      expect(isImageAttachment({ name, mimeType: null })).toBe(true);
    }
  });

  test("rejects non-image attachments", () => {
    expect(isImageAttachment({ name: "notes.md", mimeType: "text/markdown" })).toBe(false);
    expect(isImageAttachment({ name: "archive.zip", mimeType: null })).toBe(false);
  });
});
