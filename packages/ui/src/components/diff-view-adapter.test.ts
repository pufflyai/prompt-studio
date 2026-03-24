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
});
