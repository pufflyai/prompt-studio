import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExtensionWithDependency } from "./extension-fixtures";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("loads extension dependencies reached through linked package directories", () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-linked-dependencies-"));
  try {
    const extensionPath = writeExtensionWithDependency(root);
    const nodeModules = join(extensionPath, "node_modules");
    const store = join(root, "dependency-store");
    mkdirSync(store);
    for (const name of ["@pstdio/sdk", "test-dep"]) {
      const installed = join(nodeModules, name);
      const stored = join(store, name.replaceAll("/", "-"));
      renameSync(installed, stored);
      symlinkSync(stored, installed, "junction");
    }
    const sourceNodeModules = join(root, "source-node_modules");
    renameSync(nodeModules, sourceNodeModules);
    symlinkSync(sourceNodeModules, nodeModules, "junction");

    const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "check", extensionPath, "--json"], {
      cwd: root,
      env: { ...process.env, PSTDIO_HOME: root },
      encoding: "utf8",
    });
    expect(result.status, result.stdout || result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.check).toMatchObject({ errorCount: 0, warningCount: 0 });
    expect(report.check.runtime.templates).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
