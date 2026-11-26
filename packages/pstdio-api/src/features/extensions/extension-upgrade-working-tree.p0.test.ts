import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";

test("upgrade detection sees ignored local additions and leaves dependency installation out of the comparison", () => {
  const path = mkdtempSync(join(tmpdir(), "pstdio-upgrade-tree-"));
  try {
    writeFileSync(join(path, ".pstdioignore"), "local.txt\n");
    writeFileSync(join(path, "extension.ts"), "export default {};\n");
    const baseline = fingerprintUpgradeWorkingTree(path);

    mkdirSync(join(path, "node_modules"));
    writeFileSync(join(path, "node_modules", "generated"), "dependency");
    expect(fingerprintUpgradeWorkingTree(path)).toBe(baseline);

    writeFileSync(join(path, "local.txt"), "local edits");
    expect(fingerprintUpgradeWorkingTree(path)).not.toBe(baseline);
    rmSync(join(path, "local.txt"));
    expect(fingerprintUpgradeWorkingTree(path)).toBe(baseline);

    if (process.platform !== "win32") {
      symlinkSync("extension.ts", join(path, "local-link.ts"), "file");
      expect(fingerprintUpgradeWorkingTree(path)).not.toBe(baseline);
    }

    mkdirSync(join(path, ".git"));
    expect(() => fingerprintUpgradeWorkingTree(path)).toThrow("Git history");
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});
