import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncExtensionDevelopmentSource } from "./extension-development";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension } from "./install-extension-source-test-fixtures";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("dev installs local provider dependencies in their source context and reloads consumer edits", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-dev-provider-"));
  roots.push(root);
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
  expect(installed.exitCode).toBe(0);
  const input = {
    source: consumer,
    env: { ...process.env, PSTDIO_HOME: join(root, "home") },
    isPackagedRuntime: () => false,
  };
  const first = await syncExtensionDevelopmentSource(input);
  expect(first.check.errorCount).toBe(0);
  expect(first.check.warningCount).toBe(0);
  writeFileSync(join(consumer, "extension.ts"), source.replaceAll('id: "hello"', 'id: "updated"'));
  const second = await syncExtensionDevelopmentSource(input);
  expect(second.check.errorCount).toBe(0);
  expect(readFileSync(join(second.targetPath, "extension.ts"), "utf8")).toContain('id: "updated"');
  const manifest = readFileSync(join(consumer, "package.json"), "utf8");
  const lockfile = readFileSync(join(consumer, "bun.lock"), "utf8");
  const production = await installExtensionSource({ ...input, force: true });
  expect(production.check.errorCount).toBe(0);
  expect(production.check.warningCount).toBe(0);
  expect(readFileSync(join(consumer, "package.json"), "utf8")).toBe(manifest);
  expect(readFileSync(join(consumer, "bun.lock"), "utf8")).toBe(lockfile);
  rmSync(consumer, { recursive: true });
  const loaded = Bun.spawnSync(
    [
      "bun",
      "-e",
      'const extension = await import("./extension.ts"); console.log(extension.default.commands[0].run());',
    ],
    { cwd: production.targetPath },
  );
  expect(loaded.exitCode).toBe(0);
  expect(loaded.stdout.toString()).toContain("Provider command");
});
