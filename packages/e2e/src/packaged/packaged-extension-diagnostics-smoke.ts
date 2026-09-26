import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { writeExtensionWithDependency } from "./extension-fixtures";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export const registerExtensionDiagnosticsSmokeTests = () => {
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

      const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "check", "--scope", "user", "--json"], {
        cwd: root,
        env: { ...process.env, PSTDIO_HOME: root },
        encoding: "utf8",
      });
      expect(result.status, result.stdout || result.stderr).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.checks[0]).toMatchObject({ errorCount: 0, warningCount: 0 });
      expect(report.checks[0].templates).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

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
          engines: { pstdio: EXTENSION_API_VERSION },
        }),
      );
      writeFileSync(join(extensionPath, "extension.ts"), 'export { default } from "missing-desktop-dependency";');

      const result = spawnSync(PACKAGED_BINARY_PATH, ["extensions", "check", "--scope", "user", "--json"], {
        cwd: root,
        env: { ...process.env, PSTDIO_HOME: root },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout);
      expect(report.checks[0].diagnostics).toContainEqual(
        expect.objectContaining({
          code: "extension_import_failed",
          message: expect.stringContaining("missing-desktop-dependency"),
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
};
