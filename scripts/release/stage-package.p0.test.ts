import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePackage } from "./stage-package";

test("stages an independently installable package from its declared runtime files", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-package-staging-"));
  try {
    mkdirSync(join(root, "dist"));
    mkdirSync(join(root, "node_modules/public-runtime"), { recursive: true });
    writeFileSync(
      join(root, "node_modules/public-runtime/package.json"),
      JSON.stringify({ name: "public-runtime", version: "2.3.4" }),
    );
    writeFileSync(join(root, "dist/index.js"), "export const answer = 42;");
    writeFileSync(join(root, "README.md"), "Package usage.");
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "package-staging-example",
        version: "1.0.0",
        type: "module",
        files: ["dist"],
        exports: { ".": "./dist/index.js" },
        devDependencies: { "private-contracts": "workspace:*" },
        optionalDependencies: { "public-runtime": "workspace:^" },
        peerDependencies: { "public-runtime": "workspace:*" },
        peerDependenciesMeta: { "public-runtime": { optional: true } },
        publishConfig: { access: "public", directory: ".publish" },
        scripts: { prepack: "exit 1" },
      }),
    );
    const staged = stagePackage(root);
    const manifest = JSON.parse(readFileSync(join(staged, "package.json"), "utf8"));
    expect(manifest.optionalDependencies).toEqual({ "public-runtime": "^2.3.4" });
    expect(manifest.peerDependencies).toEqual({ "public-runtime": "2.3.4" });
    const packed = Bun.spawnSync(["bun", "pm", "pack", "--filename", join(root, "package.tgz")], { cwd: staged });
    expect(packed.exitCode).toBe(0);
    const consumer = join(root, "consumer");
    mkdirSync(consumer);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: { "package-staging-example": "file:../package.tgz" },
      }),
    );
    const installed = Bun.spawnSync(["bun", "install"], { cwd: consumer });
    expect(installed.exitCode).toBe(0);
    const loaded = Bun.spawnSync(
      [
        "bun",
        "--eval",
        "import assert from 'node:assert/strict'; import { answer } from 'package-staging-example'; assert.equal(answer, 42)",
      ],
      { cwd: consumer },
    );
    expect(loaded.exitCode, loaded.stderr.toString()).toBe(0);
    expect(readFileSync(join(staged, "README.md"), "utf8")).toBe("Package usage.");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
