import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyRevisionSource, visitRevisionFiles } from "./revision-file-inputs";

test("snapshots both directory aliases while blocking ancestor cycles", () => {
  const root = mkdtempSync(join(tmpdir(), "revision-directory-aliases-"));
  const source = join(root, "source");
  const target = join(root, "snapshot");
  try {
    mkdirSync(join(source, "src"), { recursive: true });
    writeFileSync(join(source, "src/extension.ts"), "export const value = 7;");
    symlinkSync(join(source, "src"), join(source, "alias"), "junction");
    symlinkSync(source, join(source, "src/ancestor"), "junction");
    const files: string[] = [];
    visitRevisionFiles(source, (_path, rel) => files.push(rel));
    expect(files.sort()).toEqual([join("alias", "extension.ts"), join("src", "extension.ts")]);
    copyRevisionSource(source, target);
    expect(readFileSync(join(target, "src/extension.ts"), "utf8")).toBe("export const value = 7;");
    expect(readFileSync(join(target, "alias/extension.ts"), "utf8")).toBe("export const value = 7;");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
