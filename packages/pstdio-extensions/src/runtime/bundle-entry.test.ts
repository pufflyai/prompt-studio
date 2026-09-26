import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundleEntry } from "./bundle-entry";

test("reports the unresolved dependency when an extension cannot be bundled", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-bundle-error-"));
  const entry = join(root, "extension.ts");
  writeFileSync(entry, 'export { default } from "missing-desktop-dependency";');
  try {
    await expect(bundleEntry(entry, root, join(root, "out"))).rejects.toThrow("missing-desktop-dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
