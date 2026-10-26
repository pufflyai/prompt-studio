import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { type CompilerObservation, subscribeExtensionCompilers } from "./extension-compiler-observations";
import { buildExtensionWebview } from "./extension-webview-builder";

describe("buildExtensionWebview", () => {
  test("reports actual compiler lifecycle and measured child resource use", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-compiler-observations-"));
    const events: CompilerObservation[] = [];
    const unsubscribe = subscribeExtensionCompilers((event) => events.push(event));
    writeFileSync(join(root, "main.ts"), "console.log('measured');");
    try {
      const result = await buildExtensionWebview({
        entryPath: join(root, "main.ts"),
        outdir: join(root, "out"),
        signal: new AbortController().signal,
      });
      expect(result.success).toBe(true);
      expect(events.map((event) => event.phase)).toEqual(["queued", "spawned", "exited"]);
      expect(new Set(events.map((event) => event.id)).size).toBe(1);
      const exited = events.find((event) => event.phase === "exited")!;
      expect(exited.pid).toBeGreaterThan(0);
      expect(exited.exitCode).toBe(0);
      expect(exited.cpuMicros).toBeGreaterThan(0);
      expect(exited.peakRssBytes).toBeGreaterThan(0);
    } finally {
      unsubscribe();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps deferred view modules in loadable browser chunks", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-lazy-test-"));
    const entryPath = join(root, "main.ts");
    const outdir = join(root, "dist");
    const key = `webview-detail-${crypto.randomUUID()}`;
    const state = globalThis as Record<string, unknown>;
    writeFileSync(entryPath, 'export const openDetails = () => import("./details.ts");');
    writeFileSync(
      join(root, "details.ts"),
      `import "./details.css"; globalThis[${JSON.stringify(key)}] = true; export const ready = true;`,
    );
    writeFileSync(join(root, "details.css"), ".details { display: grid; }");

    try {
      const result = await buildExtensionWebview({ entryPath, outdir, signal: new AbortController().signal });
      expect(result.success).toBe(true);
      const output = join(outdir, "module.js");
      const imports = new Bun.Transpiler({ loader: "js" }).scanImports(readFileSync(output, "utf8"));
      expect(imports.filter(({ kind }) => kind === "dynamic-import")).toHaveLength(1);
      expect(await Bun.file(join(outdir, "module.css")).exists()).toBe(true);
      const view = await import(pathToFileURL(output).href);
      expect(state[key]).toBeUndefined();
      expect((await view.openDetails()).ready).toBe(true);
      expect(state[key]).toBe(true);
    } finally {
      delete state[key];
      rmSync(root, { recursive: true, force: true });
    }
  });

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
