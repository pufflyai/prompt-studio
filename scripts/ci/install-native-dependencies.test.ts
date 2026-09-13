import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import manifest from "../../package.json";

test("native dependency scripts use the workspace node-gyp version with isolated installs", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pstdio-native-install-"));
  try {
    await Bun.write(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "native-install-test",
        private: true,
        dependencies: {
          "node-gyp": manifest.devDependencies["node-gyp"],
          "native-fixture": "file:./native-fixture",
        },
        trustedDependencies: ["native-fixture"],
      }),
    );
    await Bun.write(join(cwd, "bunfig.toml"), '[install]\nlinker = "isolated"\n');
    await Bun.write(
      join(cwd, "native-fixture/package.json"),
      JSON.stringify({
        name: "native-fixture",
        version: "1.0.0",
        scripts: { install: "node-gyp --version > node-gyp-version.txt" },
      }),
    );
    const lock = Bun.spawnSync([process.execPath, "install", "--lockfile-only"], { cwd });
    expect(lock.exitCode).toBe(0);
    const install = Bun.spawn(["node", join(import.meta.dirname, "install-native-dependencies.ts")], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      install.exited,
      new Response(install.stdout).text(),
      new Response(install.stderr).text(),
    ]);
    expect({ exitCode, output: exitCode === 0 ? "" : stdout + stderr }).toEqual({ exitCode: 0, output: "" });
    const version = await Bun.file(join(cwd, "node_modules/native-fixture/node-gyp-version.txt")).text();
    expect(version.trim()).toBe(`v${manifest.devDependencies["node-gyp"]}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
