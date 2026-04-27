import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { collectFiles } from "./embed-files";

describe("collectFiles", () => {
  test("excludes test files from packaged runtime embeds", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-embed-files-"));

    try {
      mkdirSync(join(root, "plugins", "opencode"), { recursive: true });
      writeFileSync(join(root, "plugins", "opencode", "pstdio-session-bridge.js"), "");
      writeFileSync(join(root, "plugins", "opencode", "pstdio-session-bridge.test.js"), "");
      writeFileSync(join(root, ".ignored"), "");

      const files = collectFiles(root, { excludeTestFiles: true })
        .map((filePath) => relative(root, filePath).replaceAll("\\", "/"))
        .sort();

      expect(files).toEqual(["plugins/opencode/pstdio-session-bridge.js"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
