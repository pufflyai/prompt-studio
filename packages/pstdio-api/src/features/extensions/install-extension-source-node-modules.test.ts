import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { copyUsableNodeModules } from "./install-extension-source-node-modules";

test("copied dependencies keep links to uploaded package files after source cleanup", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-links-"));
  try {
    const source = join(root, "upload");
    const installed = join(root, "installed");
    for (const path of [source, installed]) {
      mkdirSync(join(path, "vendor/demo"), { recursive: true });
      writeFileSync(
        join(path, "vendor/demo/package.json"),
        JSON.stringify({ name: "demo", version: "1.0.0", main: "index.ts" }),
      );
      writeFileSync(join(path, "vendor/demo/index.ts"), "export const value = 42;");
    }
    writeFileSync(join(source, "package.json"), JSON.stringify({ dependencies: { demo: "file:./vendor/demo" } }));
    const installedDependencies = Bun.spawnSync(["bun", "install", "--ignore-scripts"], { cwd: source });
    expect(installedDependencies.exitCode).toBe(0);
    copyUsableNodeModules(source, installed);
    const dependency = join(installed, "node_modules/demo/index.ts");
    expect(relative(realpathSync.native(installed), realpathSync.native(dependency))).not.toStartWith("..");
    rmSync(source, { recursive: true });
    expect(readFileSync(dependency, "utf8")).toBe("export const value = 42;");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
