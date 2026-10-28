import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExtensionWebviewBatch } from "./extension-webview-builder";

test("replacement validation builds every view with shared production dependencies", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-batch-"));
  try {
    writeFileSync(join(root, "shared.ts"), "export const mode = process.env.NODE_ENV;");
    for (const name of ["first", "second"]) {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, "index.ts"), `import {mode} from '../shared'; globalThis.${name} = mode;`);
    }
    const outdir = join(root, "dist");
    const result = await buildExtensionWebviewBatch({
      entryPaths: [join(root, "first/index.ts"), join(root, "second/index.ts")],
      outdir,
      signal: new AbortController().signal,
    });
    expect(result).toEqual({ success: true, details: "" });
    const files = [...new Bun.Glob("**/*.js").scanSync(outdir)];
    expect(files).toContain(join("first", "index.js"));
    expect(files).toContain(join("second", "index.js"));
    const modules = await Promise.all(
      ["first", "second"].map(async (name) => {
        const state = globalThis as Record<string, unknown>;
        const previous = state[name];
        try {
          await import(`${outdir}/${name}/index.js`);
          return state[name];
        } finally {
          if (previous === undefined) delete state[name];
          else state[name] = previous;
        }
      }),
    );
    expect(modules).toEqual(["production", "production"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("replacement validation rejects a broken view even when another view builds", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-batch-invalid-"));
  try {
    writeFileSync(join(root, "first.ts"), "globalThis.ready = true;");
    writeFileSync(join(root, "second.ts"), 'import "missing-webview-batch-dependency";');
    const result = await buildExtensionWebviewBatch({
      entryPaths: [join(root, "first.ts"), join(root, "second.ts")],
      outdir: join(root, "dist"),
      signal: new AbortController().signal,
    });
    expect(result.success).toBe(false);
    expect(result.details).toContain("missing-webview-batch-dependency");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
