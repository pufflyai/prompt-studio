import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectWebviewDependencyInputsAsync } from "./webview-dependency-inputs";
import { readWebviewHints } from "./webview-input-read-ahead";

test("webview validation reads updated and newly resolved files after compilation", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "webview-input-reads-")));
  try {
    const entry = join(root, "view.ts");
    const alpha = join(root, "alpha.ts");
    const bravo = join(root, "bravo.ts");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "webview-input-fixture" }));
    writeFileSync(entry, 'export { value } from "./alpha.ts";');
    writeFileSync(alpha, 'export const value = "first";');
    const before = await inspectWebviewDependencyInputsAsync(root, [entry], { capture: true });
    expect(before.reads?.map(([path]) => path)).toContain(alpha);
    const reads = before.reads!;
    const hints = { hints: reads };
    const expectFreshDigest = async () => {
      const prefetched = await inspectWebviewDependencyInputsAsync(root, [entry], hints);
      const fresh = await inspectWebviewDependencyInputsAsync(root, [entry]);
      expect(prefetched.digest).toBe(fresh.digest);
      expect(prefetched.digest).not.toBe(before.digest);
    };
    writeFileSync(alpha, 'export const value = "other";');
    expect((await readWebviewHints(reads)).get(alpha)?.toString()).toBe('export const value = "other";');
    await expectFreshDigest();
    writeFileSync(alpha, 'export const value = "a longer value";');
    expect((await readWebviewHints(reads)).has(alpha)).toBe(false);
    await expectFreshDigest();
    unlinkSync(alpha);
    writeFileSync(bravo, 'export const value = "first";');
    writeFileSync(entry, 'export { value } from "./bravo.ts";');
    await expectFreshDigest();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
