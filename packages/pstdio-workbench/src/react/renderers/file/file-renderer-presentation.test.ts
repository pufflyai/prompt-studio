import { describe, expect, test } from "bun:test";
import { resolveFileRendererPresentation } from "./file-renderer-presentation";

describe("resolveFileRendererPresentation", () => {
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
