import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("identifies a missing extension dependency in the packaged CLI", () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-extension-diagnostic-"));
  try {
    const extensionPath = join(root, "extensions", "broken-dependency");
    mkdirSync(extensionPath, { recursive: true });
    writeFileSync(
      join(extensionPath, "package.json"),
      JSON.stringify({
        name: "broken-dependency",
        version: "1.0.0",
        publisher: "test",
        main: "./extension.ts",
        type: "module",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(join(extensionPath, "extension.ts"), 'export { default } from "missing-desktop-dependency";');

    const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "check", extensionPath, "--json"], {
      cwd: root,
      env: { ...process.env, PSTDIO_HOME: root },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.check.runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_import_failed",
        message: expect.stringContaining("missing-desktop-dependency"),
      }),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
