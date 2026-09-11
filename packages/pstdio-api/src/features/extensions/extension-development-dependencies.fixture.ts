import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncExtensionDevelopmentSource } from "./extension-development";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension } from "./install-extension-source-test-fixtures";

await (async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-dev-provider-"));
  try {
    const provider = join(root, "provider");
    const consumer = join(root, "consumer");
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
    makeExtension(consumer, { name: "consumer", type: "module", dependencies: { provider: `file:${provider}` } });
    const source =
      'import { title } from "provider/contracts"; export default { commands: [{ id: "hello", ref: { kind: "command", id: "hello" }, title, run() { return title; } }] };';
    writeFileSync(join(consumer, "extension.ts"), source);
    const installed = Bun.spawnSync(["bun", "install"], { cwd: consumer });
    assert.equal(installed.exitCode, 0, installed.stderr.toString());
    const input = {
      source: consumer,
      env: { ...process.env, PSTDIO_HOME: join(root, "home") },
      isPackagedRuntime: () => false,
    };
    const first = await syncExtensionDevelopmentSource(input);
    assert.equal(first.check.errorCount, 0);
    assert.equal(first.check.warningCount, 0);
    writeFileSync(join(consumer, "extension.ts"), source.replaceAll('id: "hello"', 'id: "updated"'));
    const second = await syncExtensionDevelopmentSource(input);
    assert.equal(second.check.errorCount, 0);
    assert.ok(readFileSync(join(second.targetPath, "extension.ts"), "utf8").includes('id: "updated"'));
    const manifest = readFileSync(join(consumer, "package.json"), "utf8");
    const lockfile = readFileSync(join(consumer, "bun.lock"), "utf8");
    const production = await installExtensionSource({ ...input, force: true });
    assert.equal(production.check.errorCount, 0);
    assert.equal(production.check.warningCount, 0);
    assert.equal(readFileSync(join(consumer, "package.json"), "utf8"), manifest);
    assert.equal(readFileSync(join(consumer, "bun.lock"), "utf8"), lockfile);
    rmSync(consumer, { recursive: true });
    const loaded = Bun.spawnSync(
      [
        "bun",
        "-e",
        'const extension = await import("./extension.ts"); console.log(extension.default.commands[0].run());',
      ],
      { cwd: production.targetPath },
    );
    assert.equal(loaded.exitCode, 0);
    assert.ok(loaded.stdout.toString().includes("Provider command"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
})();
