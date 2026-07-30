import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExtensionWebview } from "./extension-webview-builder";

describe("buildExtensionWebview", () => {
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
});
