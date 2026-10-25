import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("post-build package lint preserves the outputs used by concurrent tests", async () => {
  const root = await mkdtemp(join(tmpdir(), "package-check-outputs-"));
  try {
    await mkdir(join(root, "packages/dependency/dist"), { recursive: true });
    await mkdir(join(root, "packages/consumer"), { recursive: true });
    const write = (path: string, value: unknown) => writeFile(join(root, path), JSON.stringify(value));
    await write("package.json", { private: true, workspaces: ["packages/*"], packageManager: `bun@${Bun.version}` });
    await write("lerna.json", { version: "0.0.0", npmClient: "bun" });
    await write("nx.json", { targetDefaults: { lint: { dependsOn: ["^build"] } } });
    await write("packages/dependency/package.json", { name: "dependency", scripts: { build: "bun build.ts" } });
    await write("packages/consumer/package.json", {
      name: "consumer",
      dependencies: { dependency: "workspace:*" },
      scripts: { lint: "bun lint.ts" },
    });
    await symlink(
      resolve(import.meta.dir, "../../node_modules"),
      join(root, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const artifact = join(root, "packages/dependency/dist/entry.js");
    await writeFile(artifact, "original build");
    await writeFile(join(root, "packages/dependency/build.ts"), 'await Bun.write("dist/entry.js", "replaced build");');
    await writeFile(
      join(root, "packages/consumer/lint.ts"),
      'if (await Bun.file("../dependency/dist/entry.js").text() !== "original build") throw new Error("Built outputs were replaced"); await Bun.write("lint-finished", "done");',
    );
    const child = Bun.spawn([process.execPath, join(import.meta.dir, "run-package-checks.ts"), "lint"], {
      cwd: root,
      env: { ...process.env, NX_DAEMON: "false", LERNA_FILTER: "--scope consumer" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, errors, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, output: code ? output + errors : "" }).toEqual({ code: 0, output: "" });
    expect(await Bun.file(artifact).text()).toBe("original build");
    expect(await Bun.file(join(root, "packages/consumer/lint-finished")).text()).toBe("done");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
