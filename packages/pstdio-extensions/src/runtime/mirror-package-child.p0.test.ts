import { expect, test } from "bun:test";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mirrorPackageChild } from "./mirror-package-child";

test("mirrors directories as symlinks and files per platform", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-mirror-package-child-"));
  const source = join(root, "source");
  const target = join(root, "target");
  mkdirSync(join(source, "nested"), { recursive: true });
  mkdirSync(target, { recursive: true });
  writeFileSync(join(source, "nested", "keep.txt"), "kept");
  writeFileSync(join(source, "README.md"), "# readme\n");

  try {
    mirrorPackageChild(join(source, "nested"), join(target, "nested"));
    mirrorPackageChild(join(source, "README.md"), join(target, "README.md"));

    expect(lstatSync(join(target, "nested")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(target, "nested", "keep.txt"), "utf8")).toBe("kept");

    // Windows can't symlink files without elevated privileges, so they're copied.
    expect(lstatSync(join(target, "README.md")).isSymbolicLink()).toBe(process.platform !== "win32");
    expect(readFileSync(join(target, "README.md"), "utf8")).toBe("# readme\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
