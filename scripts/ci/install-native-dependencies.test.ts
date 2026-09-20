import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("native dependency scripts use the workspace node-gyp version with isolated installs", async () => {
  const manifest = await Bun.file(new URL("../../package.json", import.meta.url)).json();
  // Expand Windows short names before Bun records workspace paths in the lockfile.
  const cwd = realpathSync.native(mkdtempSync(join(tmpdir(), "pstdio-native-install-")));
  try {
    await Bun.write(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "native-install-test",
        private: true,
        workspaces: ["clients/*"],
        devDependencies: { "node-gyp": manifest.devDependencies["node-gyp"] },
        trustedDependencies: ["native-fixture"],
      }),
    );
    await Bun.write(
      join(cwd, "clients/app/package.json"),
      JSON.stringify({ name: "native-consumer", dependencies: { "native-fixture": "file:../../native-fixture" } }),
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
    // Reuse metadata on repeated runs; the early CI smoke can start with an empty metadata cache.
    const lock = Bun.spawnSync([process.execPath, "install", "--lockfile-only", "--prefer-offline"], { cwd });
    expect({ exitCode: lock.exitCode, output: lock.exitCode === 0 ? "" : lock.stderr.toString() }).toEqual({
      exitCode: 0,
      output: "",
    });
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
    const version = await Bun.file(join(cwd, "clients/app/node_modules/native-fixture/node-gyp-version.txt")).text();
    expect(version.trim()).toBe(`v${manifest.devDependencies["node-gyp"]}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
