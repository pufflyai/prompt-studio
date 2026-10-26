import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension } from "./install-extension-source-test-fixtures";

test("installs local providers into a canonical repo source in place", async () => {
  const root = mkdtempSync(join(tmpdir(), "sdk-review-in-place-"));
  try {
    const repo = join(root, "repo");
    const provider = join(root, "provider");
    const consumer = join(repo, ".pstdio", "extensions", "consumer");
    mkdirSync(provider);
    writeFileSync(
      join(provider, "package.json"),
      JSON.stringify({
        name: "provider",
        version: "1.0.0",
        type: "module",
        exports: { "./contracts": "./contracts.ts" },
      }),
    );
    writeFileSync(join(provider, "contracts.ts"), 'export const title = "Provider command";');
    makeExtension(consumer, {
      name: "consumer",
      type: "module",
      pstdio: { scope: "repo" },
      dependencies: { provider: `file:${provider}` },
    });
    writeFileSync(
      join(consumer, "extension.ts"),
      'import { title } from "provider/contracts"; export default { commands: [{ id: "hello", ref: { kind: "command", id: "hello" }, title, run() { return title; } }] };',
    );
    const result = await installExtensionSource({
      source: consumer,
      repoPath: repo,
      env: { ...process.env, PSTDIO_HOME: join(root, "home") },
      isPackagedRuntime: () => false,
    });
    expect(result.check.errorCount).toBe(0);
    expect(result.targetPath).toBe(consumer);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
