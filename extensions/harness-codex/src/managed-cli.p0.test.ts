import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { resolveManagedCodex } from "./managed-cli";

for (const platform of ["darwin", "linux", "win32"] as const) {
  for (const arch of ["x64", "arm64"]) {
    test(`resolves the private native CLI for ${platform} ${arch}`, () => {
      const command = resolveManagedCodex({
        platform,
        arch,
        resolvePackage: (name) => join("/packages", name, "package.json"),
        exists: () => true,
      });
      expect(command).not.toBeNull();
      expect(command).toEndWith(platform === "win32" ? "codex.exe" : "codex");
    });
  }
}

test("reports a missing native dependency without invoking an installer", () => {
  expect(
    resolveManagedCodex({
      resolvePackage: () => {
        throw new Error("Not installed");
      },
    }),
  ).toBeNull();
});

test("finds a managed CLI published after the harness worker loads", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-codex-managed-")));
  try {
    const extensions = join(root, "extension");
    const source = join(extensions, "src");
    const modules = join(root, "dependencies", "node_modules");
    const entry = join(root, "worker.ts");
    const wrapper = join(modules, "@openai", "codex", "package.json");
    const binary = join(modules, "@openai", "codex-darwin-arm64", "vendor", "aarch64-apple-darwin", "bin", "codex");
    mkdirSync(source, { recursive: true });
    mkdirSync(dirname(wrapper), { recursive: true });
    mkdirSync(dirname(binary), { recursive: true });
    writeFileSync(wrapper, "{}");
    writeFileSync(join(modules, "@openai", "codex-darwin-arm64", "package.json"), "{}");
    writeFileSync(binary, "");
    copyFileSync(join(import.meta.dirname, "managed-cli.ts"), join(source, "managed-cli.ts"));
    writeFileSync(
      entry,
      `import { symlinkSync } from "node:fs";
import { resolveManagedCodex } from "./extension/src/managed-cli";
symlinkSync(${JSON.stringify(modules)}, ${JSON.stringify(join(extensions, "node_modules"))}, "junction");
console.log(resolveManagedCodex({ platform: "darwin", arch: "arm64" }));`,
    );
    const result = Bun.spawnSync([process.execPath, "--no-install", entry], { cwd: root });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(result.stdout.toString().trim()).toBe(binary);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
