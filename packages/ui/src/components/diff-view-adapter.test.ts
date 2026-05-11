import { describe, expect, it } from "bun:test";
import { buildDiffViewData, resolveDiffLanguage } from "./diff-view-adapter";

describe("resolveDiffLanguage", () => {
  it("uses explicit language when provided", () => {
    expect(resolveDiffLanguage({ language: "typescript", oldPath: "old.js", newPath: "new.js" })).toBe("typescript");
  });

  it("infers from path when language is missing", () => {
    expect(resolveDiffLanguage({ oldPath: "src/api/handler.py" })).toBe("python");
    expect(resolveDiffLanguage({ newPath: "README.md" })).toBe("markdown");
  });

  it("falls back to plaintext when extension is unknown", () => {
    expect(resolveDiffLanguage({ oldPath: "file.unknown" })).toBe("plaintext");
  });
});

describe("buildDiffViewData", () => {
  it("builds deterministic diff data with inferred metadata", () => {
    const data = buildDiffViewData({
      original: "const a = 1;\nconst b = 2;\n",
      modified: "const a = 1;\nconst b = 3;\n",
      oldPath: "src/sample.ts",
      newPath: "src/sample.ts",
    });

    expect(data.oldFile?.fileName).toBe("src/sample.ts");
    expect(data.newFile?.fileName).toBe("src/sample.ts");
    expect(data.oldFile?.fileLang).toBe("typescript");
    expect(data.newFile?.fileLang).toBe("typescript");
    expect(data.hunks.length).toBe(1);
    expect(data.hunks[0]).toContain("@@");
  });

  it("uses limited context so hunks are expandable", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const modified = [...lines];
    modified[15] = "changed line 16";

    const data = buildDiffViewData({
      original: lines.join("\n"),
      modified: modified.join("\n"),
      oldPath: "big.ts",
      newPath: "big.ts",
    });

    // With limited context (3), only lines near the change are included
    const hunkContent = data.hunks.join("\n");
    expect(hunkContent).not.toContain("line 2\n");
    expect(hunkContent).not.toContain("line 30");
    expect(hunkContent).toContain("changed line 16");
  });
});
