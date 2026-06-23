import { describe, expect, test } from "bun:test";
import { createFileRendererLoadKey, isCurrentLoadedFile } from "./file-renderer-load-key";

describe("file renderer loaded state", () => {
  test("does not treat content loaded for one renderer as current for another renderer", () => {
    const markdownLoadKey = createFileRendererLoadKey({
      fileRendererId: "file-renderer.story.markdown",
      resourceUri: undefined,
    });
    const codeLoadKey = createFileRendererLoadKey({
      fileRendererId: "file-renderer.story.code",
      resourceUri: undefined,
    });

    expect(isCurrentLoadedFile({ loadKey: markdownLoadKey }, codeLoadKey)).toBe(false);
  });
});
