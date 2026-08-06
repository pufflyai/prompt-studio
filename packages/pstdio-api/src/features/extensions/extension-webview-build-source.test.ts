import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";

describe("prepareManagedWebviewBuildSource", () => {
  test("returns an actionable failure before preparing a shell when declared dependencies are missing", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-source-test-"));
    const packagePath = join(root, "extension");
    const entryPath = join(packagePath, "src", "main.tsx");
    const shellDir = join(root, "cache", "source");
    mkdirSync(join(packagePath, "src"), { recursive: true });
    writeFileSync(
      join(packagePath, "package.json"),
      JSON.stringify({ name: "test-extension", dependencies: { react: "^19.0.0", zustand: "^5.0.0" } }),
    );
    writeFileSync(entryPath, "console.log('webview');");
    mkdirSync(join(packagePath, "node_modules", "react"), { recursive: true });
    writeFileSync(
      join(packagePath, "node_modules", "react", "package.json"),
      JSON.stringify({ name: "react", version: "19.0.0" }),
    );

    try {
      const buildInputs = inspectManagedWebviewBuildInputs({
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
      });
      const result = prepareManagedWebviewBuildSource({
        buildInputs,
        entryPath,
        installName: "test-extension",
        packageName: "test-extension",
        packagePath,
        shellDir,
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected missing dependencies to fail source preparation.");
      expect(buildInputs.missingDependencies).toEqual(["zustand"]);
      expect(result.details).not.toContain("react");
      expect(result.details).toContain("zustand");
      expect(result.details).toContain("bun install");
      expect(existsSync(shellDir)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
