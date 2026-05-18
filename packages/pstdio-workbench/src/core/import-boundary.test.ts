import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const coreRoot = join(import.meta.dir, ".");
// Match `import ... from "pkg"` but NOT `import type ... from "pkg"` — type-only
// imports are erased at compile time and don't create a runtime dependency.
const forbiddenImportPattern =
  /^import\s+(?!type\s)[^;]*\bfrom\s+["'](?:@pstdio\/ui|react|react-dom|@chakra-ui\/react|@chakra-ui\/charts|.*pstdio-dashboard.*)["']/m;

const sourceFilesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFilesUnder(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });

describe("pstdio-workbench core import boundary", () => {
  test("does not import React, Chakra, @pstdio/ui, or dashboard modules", () => {
    const violations = sourceFilesUnder(coreRoot)
      .map((filePath) => ({
        filePath,
        content: readFileSync(filePath, "utf8"),
      }))
      .filter(({ content }) => forbiddenImportPattern.test(content))
      .map(({ filePath }) => relative(coreRoot, filePath));

    expect(violations).toEqual([]);
  });
});
