import { describe, expect, it } from "bun:test";
import { getFileExtension, getImagePreviewMimeType, imagePreviewExtensions, isImagePreviewPath } from ".";

describe("file type helpers", () => {
  it("resolves image preview MIME types from shared extensions", () => {
    expect(getImagePreviewMimeType("assets/logo.PNG")).toBe("image/png");
    expect(getImagePreviewMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(imagePreviewExtensions).toContain("webp");
  });

  it("keeps SVG out of image previews because it is text-diffable", () => {
    expect(isImagePreviewPath("icons/check.svg")).toBe(false);
  });

  it("extracts file extensions consistently across path separators", () => {
    expect(getFileExtension("public/assets/logo.PNG")).toBe("png");
    expect(getFileExtension("public\\assets\\logo.PNG")).toBe("png");
    expect(getFileExtension("README")).toBe("readme");
  });
});
