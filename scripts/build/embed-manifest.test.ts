import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveEmbedFiles } from "./embed-manifest";

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-embed-manifest-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("resolveEmbedFiles", () => {
  test("skips node_modules when expanding directory globs", () => {
    const root = makeTempDir();
    const tree = join(root, "extension");
    mkdirSync(join(tree, "src"), { recursive: true });
    mkdirSync(join(tree, "node_modules", "dependency"), { recursive: true });
    writeFileSync(join(tree, "src", "extension.ts"), "export default {};");
    writeFileSync(join(tree, "src", "extension.test.ts"), "test('sample', () => {});");
    writeFileSync(join(tree, "node_modules", "dependency", "index.js"), "export default {};");

    const files = resolveEmbedFiles({
      files: [],
      globs: [join(tree, "**")],
      noStraysIn: [],
      platformBinaries: [],
      buildTargets: [],
    });

    expect(files).toContain(join(tree, "src", "extension.ts").replaceAll("\\", "/"));
    expect(files).not.toContain(join(tree, "src", "extension.test.ts").replaceAll("\\", "/"));
    expect(files).not.toContain(join(tree, "node_modules", "dependency", "index.js").replaceAll("\\", "/"));
  });
});
