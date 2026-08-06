import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExtensionWebview, formatExtensionWebviewBuildError } from "./extension-webview-builder";

describe("buildExtensionWebview", () => {
  test("formats ordinary build errors", () => {
    expect(formatExtensionWebviewBuildError(new Error("Build process stopped"))).toBe("Build process stopped");
  });

  test("formats aggregate diagnostics once in their original order", () => {
    const error = new AggregateError(
      [new Error("Missing first package"), new Error("Missing second package"), new Error("Bundle failed")],
      "Bundle failed",
    );

    expect(formatExtensionWebviewBuildError(error)).toBe(
      "Bundle failed\nMissing first package\nMissing second package",
    );
  });

  test("expands nested aggregate diagnostics once in depth-first order", () => {
    const error = new AggregateError(
      [
        new Error("Missing first package"),
        new AggregateError(
          [new Error("Missing second package"), new Error("Bundle failed")],
          "Dependency resolution failed",
        ),
      ],
      "Bundle failed",
    );

    expect(formatExtensionWebviewBuildError(error)).toBe(
      "Bundle failed\nMissing first package\nDependency resolution failed\nMissing second package",
    );
  });

  test("builds a browser module in the current Bun process", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-builder-test-"));
    const entryPath = join(root, "main.ts");
    const outdir = join(root, "dist");
    const controller = new AbortController();
    writeFileSync(entryPath, "document.body.textContent = 'hello';");

    try {
      const result = await buildExtensionWebview({ entryPath, outdir, signal: controller.signal });

      expect(result).toEqual({ success: true, details: "" });
      expect(existsSync(join(outdir, "module.js"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("preserves Bun diagnostics for unresolved imports", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-builder-test-"));
    const entryPath = join(root, "main.ts");
    const outdir = join(root, "dist");
    const controller = new AbortController();
    const missingPackage = "pstdio-missing-webview-dependency";
    writeFileSync(entryPath, `import ${JSON.stringify(missingPackage)};`);

    try {
      const result = await buildExtensionWebview({ entryPath, outdir, signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.details).toContain("Could not resolve");
      expect(result.details).toContain(missingPackage);
      expect(result.details).toContain("bun install");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
