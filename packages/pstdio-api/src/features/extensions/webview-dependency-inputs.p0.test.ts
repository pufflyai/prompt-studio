import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { inspectWebviewDependencyInputsAsync } from "./webview-dependency-inputs";
import { readWebviewHints, type WebviewInputHints } from "./webview-input-read-ahead";

const inspect = async (packagePath: string, entry: string, inputHints?: WebviewInputHints, captureHints = false) => {
  const { stdout, stderr, exited } = Bun.spawn(
    [process.execPath, fileURLToPath(new URL("./webview-input-inspector.entry.ts", import.meta.url))],
    {
      cwd: packagePath,
      stdin: new Blob([JSON.stringify({ packagePath, entryPaths: [entry], timings: true, inputHints, captureHints })]),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [result, diagnostics, status] = await Promise.all([
    new Response(stdout).text(),
    new Response(stderr).text(),
    exited,
  ]);
  if (status !== 0) throw new Error(diagnostics);
  return JSON.parse(result) as Awaited<ReturnType<typeof inspectWebviewDependencyInputsAsync>>;
};

test("webview validation reads updated and newly resolved files after compilation", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "webview-input-reads-")));
  try {
    const entry = join(root, "view.ts");
    const alpha = join(root, "alpha.ts");
    const bravo = join(root, "bravo.ts");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "webview-input-fixture" }));
    writeFileSync(entry, 'export { value } from "./alpha.ts";');
    writeFileSync(alpha, 'export const value = "first";');
    const before = await inspect(root, entry, undefined, true);
    const hints = before.hints!;
    expect(hints.reads.map(([path]) => path)).toContain(alpha);
    expect(hints.imports.length).toBeGreaterThan(0);
    const expectFreshDigest = async () => {
      const prefetched = await inspect(root, entry, hints);
      const fresh = await inspect(root, entry);
      expect(prefetched.digest).toBe(fresh.digest);
      expect(prefetched.digest).not.toBe(before.digest);
    };
    writeFileSync(alpha, 'export const value = "other";');
    expect((await readWebviewHints(hints.reads)).get(alpha)?.toString()).toBe('export const value = "other";');
    await expectFreshDigest();
    writeFileSync(alpha, 'export const value = "a longer value";');
    expect((await readWebviewHints(hints.reads)).has(alpha)).toBe(false);
    await expectFreshDigest();
    unlinkSync(alpha);
    writeFileSync(bravo, 'export const value = "first";');
    writeFileSync(entry, 'export { value } from "./bravo.ts";');
    await expectFreshDigest();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
