import { describe, expect, test } from "bun:test";
import { resolveFileRendererPresentation } from "./file-renderer-presentation";

describe("resolveFileRendererPresentation", () => {
  test("keeps source-owned saving when an unknown-format document supplies initial content", () => {
    expect(
      resolveFileRendererPresentation(
        { fileName: "notes.unknown", content: "initial", textDocument: { sourceId: "document", params: {} } },
        false,
      ),
    ).toEqual({ kind: "markdown", isEditable: false });
  });

  test("opens log files in the code editor with plain-text highlighting", () => {
    expect(
      resolveFileRendererPresentation({ fileName: "test.log", mimeType: "text/plain", content: "# raw log" }, true),
    ).toEqual({ kind: "code", isEditable: true, language: "plaintext" });
  });

  test("uses Monaco for explicitly requested workspace text", () => {
    expect(
      resolveFileRendererPresentation(
        { fileName: "README.md", content: "# Readme", textRenderer: "monaco", editable: true },
        true,
      ),
    ).toEqual({ kind: "code", isEditable: true, language: "markdown" });
  });

  test("keeps automatic markdown behavior for existing consumers", () => {
    expect(resolveFileRendererPresentation({ fileName: "README.md", content: "# Readme" }, true)).toEqual({
      kind: "markdown",
      isEditable: true,
    });
  });

  test("honors per-file read-only state and deliberate empty state", () => {
    expect(resolveFileRendererPresentation({ fileName: "notes.txt", editable: false }, true)).toEqual({
      kind: "markdown",
      isEditable: false,
    });
    expect(
      resolveFileRendererPresentation(
        { emptyState: { title: "Select a file", description: "Choose a file from Files." } },
        true,
      ),
    ).toEqual({ kind: "empty", isEditable: false });
  });
});
