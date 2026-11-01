import { expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

test("native dependency scripts use the workspace node-gyp and the install does not replace it later", async () => {
  const manifest = await Bun.file(new URL("../../package.json", import.meta.url)).json();
  // Expand Windows short names before Bun records workspace paths in the lockfile.
  const cwd = realpathSync.native(mkdtempSync(join(tmpdir(), "pstdio-native-install-")));
  const env = { ...process.env, BUN_INSTALL: join(cwd, "bun"), BUN_CONFIG_REGISTRY: "http://127.0.0.1:1" };
  const nodeGyp = realpathSync.native(dirname(Bun.resolveSync("node-gyp/package.json", import.meta.dir)));
  try {
    // Keep Bun's link registry inside the fixture and use the real workspace tool.
    const linked = Bun.spawnSync([process.execPath, "link"], { cwd: nodeGyp, env });
    expect({ exitCode: linked.exitCode, output: linked.exitCode === 0 ? "" : linked.stderr.toString() }).toEqual({
      exitCode: 0,
      output: "",
    });
    await Bun.write(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "native-install-test",
        private: true,
        workspaces: ["clients/*"],
        devDependencies: {
          "node-gyp": "link:node-gyp",
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
      JSON.stringify({ name: "root-build-step", version: "1.0.0", scripts: { install: "bun wait.ts" } }),
    );
    await Bun.write(join(cwd, "root-build-step/wait.ts"), "setTimeout(() => {}, 500);\n");
    await Bun.write(
      join(cwd, "native-fixture/package.json"),
      JSON.stringify({
        name: "native-fixture",
        version: "1.0.0",
        scripts: { install: "bun link-state.ts > node-gyp-link.txt && node-gyp --version > node-gyp-version.txt" },
      }),
    );
    const linkState = join(cwd, "native-fixture/link-state.ts");
    await Bun.write(
      linkState,
      `import { lstatSync } from "node:fs";
try {
  const link = lstatSync(${JSON.stringify(join(cwd, "node_modules/.bin/node-gyp"))});
  console.log(link.ino + ":" + link.ctimeMs);
} catch {
  console.log("absent");
}
`,
    );
    // Exercise the workspace's real installed tool and its existing dependencies.
    // Registry resolution is not part of the root-bin ownership contract.
    const lock = Bun.spawnSync([process.execPath, "install", "--lockfile-only", "--offline"], { cwd, env });
    expect({ exitCode: lock.exitCode, output: lock.exitCode === 0 ? "" : lock.stderr.toString() }).toEqual({
      exitCode: 0,
      output: "",
    });
    const install = Bun.spawn([process.execPath, join(import.meta.dirname, "install-native-dependencies.ts")], {
      cwd,
      env,
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
    // Bun's Windows node-gyp.cmd wrapper echoes its command before node-gyp prints the version.
    const version = (await Bun.file(join(fixture, "node-gyp-version.txt")).text()).trim().split(/\r?\n/).at(-1);
    expect(version).toBe(`v${manifest.devDependencies["node-gyp"]}`);
    // A build may start before the root link exists and use Bun's wrapper. It must never see a link the install replaces later.
    const seen = (await Bun.file(join(fixture, "node-gyp-link.txt")).text()).trim();
    const final = Bun.spawnSync([process.execPath, linkState]).stdout.toString().trim();
    expect(["absent", final]).toContain(seen);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}, 15_000);
