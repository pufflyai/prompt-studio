import { describe, expect, mock, test } from "bun:test";
import { loadArtifactContent } from "./use-artifact-content";

describe("loadArtifactContent", () => {
  test("loads artifact content successfully", async () => {
    const getTicketFileContentMock = mock(async () => "validation output");
    const controller = new AbortController();

    const result = await loadArtifactContent("ticket-1", "file-1", controller.signal, getTicketFileContentMock);

    expect(result).toEqual({ content: "validation output", error: null, aborted: false });
  });

  test("returns aborted state on abort errors", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const getTicketFileContentMock = mock(async () => {
      throw abortError;
    });
    const controller = new AbortController();

    const result = await loadArtifactContent("ticket-1", "file-1", controller.signal, getTicketFileContentMock);

    expect(result).toEqual({ content: undefined, error: null, aborted: true });
  });

  test("returns an error state on non-abort failures", async () => {
    const getTicketFileContentMock = mock(async () => {
      throw new Error("network failed");
    });
    const controller = new AbortController();

    const result = await loadArtifactContent("ticket-1", "file-1", controller.signal, getTicketFileContentMock);

    expect(result).toEqual({
      content: "",
      error: "Failed to load artifact content.",
      aborted: false,
    });
  });
});
