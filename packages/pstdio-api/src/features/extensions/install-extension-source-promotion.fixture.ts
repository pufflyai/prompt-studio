import { strict as assert } from "node:assert";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension } from "./install-extension-source-test-fixtures";

await (async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-promotion-"));
  try {
    const source = join(root, "source");
    makeExtension(source, { dependencies: { provider: "1.0.0" } });
    const provider = join(source, "node_modules", "provider");
    mkdirSync(provider, { recursive: true });
    writeFileSync(join(provider, "package.json"), JSON.stringify({ name: "provider", main: "index.js" }));
    writeFileSync(join(provider, "index.js"), 'export const title = "Hello";');
    writeFileSync(
      join(source, "extension.ts"),
      'import { title } from "provider"; export default { commands: [{ id: "hello", ref: { kind: "command", id: "hello" }, title, run() {} }] };',
    );
    const input = {
      source,
      env: { ...process.env, PSTDIO_HOME: join(root, "home") },
      runCommand: async (_command: string, _args: string[], options: { cwd: string }) => {
        cpSync(join(source, "node_modules"), join(options.cwd, "node_modules"), { recursive: true });
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    };
    await installExtensionSource(input);
    writeFileSync(join(source, "README.md"), "Updated source");
    const installed = await installExtensionSource({ ...input, force: true });
    assert.equal(installed.check.errorCount, 0);
    assert.equal(readFileSync(join(installed.targetPath, "README.md"), "utf8"), "Updated source");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
})();
