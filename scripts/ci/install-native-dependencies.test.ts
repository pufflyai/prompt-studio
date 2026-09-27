import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("native dependency scripts use the workspace node-gyp and the install does not replace it later", async () => {
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
        devDependencies: {
          "node-gyp": manifest.devDependencies["node-gyp"],
          "root-build-step": "file:./root-build-step",
        },
        trustedDependencies: ["native-fixture", "root-build-step"],
      }),
    );
    await Bun.write(
      join(cwd, "clients/app/package.json"),
      JSON.stringify({ name: "native-consumer", dependencies: { "native-fixture": "file:../../native-fixture" } }),
    );
    await Bun.write(join(cwd, "bunfig.toml"), '[install]\nlinker = "isolated"\n');
    // Bun links root bins only after every root dependency finishes. This slow root dependency makes the
    // workspace native build start first, which is when replacing the root node-gyp link breaks the build.
    await Bun.write(
      join(cwd, "root-build-step/package.json"),
      JSON.stringify({ name: "root-build-step", version: "1.0.0", scripts: { install: "node wait.cjs" } }),
    );
    await Bun.write(join(cwd, "root-build-step/wait.cjs"), "setTimeout(() => {}, 500);\n");
    await Bun.write(
      join(cwd, "native-fixture/package.json"),
      JSON.stringify({
        name: "native-fixture",
        version: "1.0.0",
        scripts: { install: "node link-state.cjs > node-gyp-link.txt && node-gyp --version > node-gyp-version.txt" },
      }),
    );
    const linkState = join(cwd, "native-fixture/link-state.cjs");
    await Bun.write(
      linkState,
      `const { lstatSync } = require("node:fs");
try {
  const link = lstatSync(${JSON.stringify(join(cwd, "node_modules/.bin/node-gyp"))});
  console.log(link.ino + ":" + link.ctimeMs);
} catch {
  console.log("absent");
}
`,
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
    const fixture = join(cwd, "clients/app/node_modules/native-fixture");
    const version = await Bun.file(join(fixture, "node-gyp-version.txt")).text();
    expect(version.trim()).toBe(`v${manifest.devDependencies["node-gyp"]}`);
    // A build may start before the root link exists and use Bun's wrapper. It must never see a link the install replaces later.
    const seen = (await Bun.file(join(fixture, "node-gyp-link.txt")).text()).trim();
    const final = Bun.spawnSync(["node", linkState]).stdout.toString().trim();
    expect(["absent", final]).toContain(seen);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}, 30_000);
