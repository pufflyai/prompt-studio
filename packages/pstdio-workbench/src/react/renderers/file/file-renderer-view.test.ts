import { describe, expect, test } from "bun:test";
import {
  createFileRendererDocumentKey,
  createFileRendererLoadKey,
  isCurrentLoadedFile,
} from "./file-renderer-load-key";

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

  test("identifies different loaded documents within the same renderer resource", () => {
    const loadKey = createFileRendererLoadKey({
      fileRendererId: "pstdio-planner.ticketContent",
      resourceUri: "pstdio://ticket/ticket-1",
    });

    const firstFileKey = createFileRendererDocumentKey({
      loadKey,
      documentId: "file-1",
      fileName: "notes.md",
      mimeType: undefined,
    });
    const secondFileKey = createFileRendererDocumentKey({
      loadKey,
      documentId: "file-2",
      fileName: "notes.md",
      mimeType: undefined,
    });
    const reloadedFirstFileKey = createFileRendererDocumentKey({
      loadKey,
      documentId: "file-1",
      fileName: "notes.md",
      mimeType: undefined,
    });

    expect(firstFileKey).not.toBe(secondFileKey);
    expect(firstFileKey).toBe(reloadedFirstFileKey);
  });
});
