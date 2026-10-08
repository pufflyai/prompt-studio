import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashExtensionDependencyInputs } from "./hash-extension-dependency-inputs";

test("hashExtensionDependencyInputs changes only for package and Bun lock inputs", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-dependency-hash-"));
  writeFileSync(join(root, "package.json"), '{"dependencies":{}}\n');

  try {
    const initial = hashExtensionDependencyInputs(root);
    writeFileSync(join(root, "extension.ts"), "export default {};\n");
    expect(hashExtensionDependencyInputs(root)).toBe(initial);

    writeFileSync(join(root, "bun.lock"), "lockfileVersion = 1\n");
    expect(hashExtensionDependencyInputs(root)).not.toBe(initial);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
