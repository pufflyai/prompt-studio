import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { buildExtensionWebview } from "./extension-webview-builder";

describe("buildExtensionWebview", () => {
  test("builds self-contained production browser code", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-builder-test-"));
    const entryPath = join(root, "main.ts");
    const outdir = join(root, "dist");
    const controller = new AbortController();
    writeFileSync(entryPath, "globalThis.extensionMode = process.env.NODE_ENV;");

    try {
      const result = await buildExtensionWebview({ entryPath, outdir, signal: controller.signal });

      expect(result).toEqual({ success: true, details: "" });
      const browserGlobals: { extensionMode?: string } = {};
      runInNewContext(readFileSync(join(outdir, "module.js"), "utf8"), browserGlobals);
      expect(browserGlobals.extensionMode).toBe("production");
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

  test("builds the dependency files present at build time after an extension folder is replaced", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-builder-test-"));
    const packagePath = join(root, "extension");
    const controller = new AbortController();
    // An extension update replaces its folder, including node_modules, while the host keeps running.
    const writeExtension = (folder: string, exports: Record<string, string>, entry: string) => {
      mkdirSync(join(folder, "node_modules", "ui"), { recursive: true });
      writeFileSync(join(folder, "node_modules", "ui", "package.json"), JSON.stringify({ name: "ui", exports }));
      writeFileSync(join(folder, "node_modules", "ui", "index.js"), "export const shell = 'shell';");
      writeFileSync(join(folder, "node_modules", "ui", "timeline.js"), "export const timeline = 'timeline';");
      writeFileSync(join(folder, "main.ts"), entry);
    };

    try {
      writeExtension(packagePath, { ".": "./index.js" }, 'import { shell } from "ui"; console.log(shell);');
      const first = await buildExtensionWebview({
        entryPath: join(packagePath, "main.ts"),
        outdir: join(root, "first"),
        signal: controller.signal,
      });
      expect(first).toEqual({ success: true, details: "" });

      const next = join(root, "next");
      writeExtension(
        next,
        { ".": "./index.js", "./timeline": "./timeline.js" },
        'import { timeline } from "ui/timeline"; console.log(timeline);',
      );
      renameSync(packagePath, join(root, "previous"));
      renameSync(next, packagePath);

      const second = await buildExtensionWebview({
        entryPath: join(packagePath, "main.ts"),
        outdir: join(root, "second"),
        signal: controller.signal,
      });
      expect(second).toEqual({ success: true, details: "" });
      expect(readFileSync(join(root, "second", "module.js"), "utf8")).toContain("timeline");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
