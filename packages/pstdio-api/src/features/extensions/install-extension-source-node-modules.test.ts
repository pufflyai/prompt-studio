import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyUsableNodeModules } from "./install-extension-source-node-modules";

test("copied dependencies keep links to uploaded package files after source cleanup", () => {
  const root = mkdtempSync(join(tmpdir(), "extension-links-"));
  try {
    const source = join(root, "upload");
    const installed = join(root, "installed");
    for (const path of [source, installed]) {
      mkdirSync(join(path, "vendor/demo"), { recursive: true });
      writeFileSync(join(path, "vendor/demo/index.ts"), "export const value = 42;");
    }
    writeFileSync(join(source, "package.json"), JSON.stringify({ dependencies: { demo: "link:./vendor/demo" } }));
    mkdirSync(join(source, "node_modules"));
    symlinkSync("../vendor/demo", join(source, "node_modules/demo"), "junction");
    copyUsableNodeModules(source, installed);
    rmSync(source, { recursive: true });
    expect(Bun.file(join(installed, "node_modules/demo/index.ts")).size).toBeGreaterThan(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
