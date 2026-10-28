import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("a Notes changeset creates only a Notes version and changelog entry", async () => {
  const root = await mkdtemp(join(tmpdir(), "independent-version-"));
  const write = async (path: string, data: unknown) => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    const config = await Bun.file(new URL("../../.changeset/config.json", import.meta.url)).json();
    await write("package.json", { private: true, workspaces: ["packages/*"] });
    await write(".changeset/config.json", {
      ...config,
      changelog: "@changesets/cli/changelog",
      fixed: [["pstdio", "@pstdio/sdk"]],
      ignore: [],
      privatePackages: { version: true, tag: false },
    });
    for (const [dir, name] of [
      ["host", "pstdio"],
      ["sdk", "@pstdio/sdk"],
      ["notes", "pstdio-notes"],
      ["planner", "pstdio-planner"],
    ]) {
      await write(`packages/${dir}/package.json`, { name, version: "0.45.0", private: true });
    }
    await write(".changeset/notes.md", '---\n"pstdio-notes": patch\n---\n\nFix Notes.\n');
    const child = Bun.spawn([process.execPath, Bun.resolveSync("@changesets/cli/bin.js", import.meta.dir), "version"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const result = await child.exited;
    const stderr = await new Response(child.stderr).text();
    expect({ result, stderr }).toMatchObject({ result: 0 });
    expect((await Bun.file(join(root, "packages/notes/package.json")).json()).version).toBe("0.45.1");
    for (const dir of ["host", "sdk", "planner"]) {
      expect((await Bun.file(join(root, `packages/${dir}/package.json`)).json()).version).toBe("0.45.0");
      expect(await Bun.file(join(root, `packages/${dir}/CHANGELOG.md`)).exists()).toBe(false);
    }
    expect(await Bun.file(join(root, "packages/notes/CHANGELOG.md")).exists()).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);
