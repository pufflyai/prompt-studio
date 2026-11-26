import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../test-utils/expect-rejection";
import { copyRevisionFiles, copyRevisionSource, visitRevisionFiles } from "./revision-file-inputs";

test("snapshots both directory aliases while blocking ancestor cycles", async () => {
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
    await copyRevisionSource(source, target);
    expect(readFileSync(join(target, "src/extension.ts"), "utf8")).toBe("export const value = 7;");
    expect(readFileSync(join(target, "alias/extension.ts"), "utf8")).toBe("export const value = 7;");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a conflicting snapshot input stops new copies and drains the admitted write", async () => {
  const root = mkdtempSync(join(tmpdir(), "revision-copy-conflict-"));
  const accepted = join(root, "accepted.txt");
  const conflicting = join(root, "conflicting.txt");
  const target = join(root, "snapshot", "first.txt");
  const next = join(root, "snapshot", "next.txt");
  try {
    writeFileSync(accepted, "accepted bytes");
    writeFileSync(conflicting, "separate bytes");
    await expectRejection(
      copyRevisionFiles([
        { source: accepted, target },
        { source: conflicting, target },
        { source: accepted, target: next },
      ]),
    ).toThrow("Snapshot file has conflicting source owners.");
    expect(readFileSync(target, "utf8")).toBe("accepted bytes");
    expect(existsSync(next)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
