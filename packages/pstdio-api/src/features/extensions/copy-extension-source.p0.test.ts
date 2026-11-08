import { expect, test } from "bun:test";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyExtensionSource } from "./copy-extension-source";

test("stages a complete source tree without changing its files, modes, links, or ignore policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-source-copy-"));
  const source = join(root, "source");
  const target = join(root, "target");
  const baseline = join(root, "baseline");
  try {
    for (const path of ["src/nested", ".git", "dist", "node_modules/dep"]) {
      await mkdir(join(source, path), { recursive: true });
    }
    await writeFile(join(source, ".gitignore"), "dist/\n.git/\n");
    await writeFile(join(source, ".git/HEAD"), "ref: refs/heads/main\n");
    await writeFile(join(source, "dist/ignored.js"), "ignored");
    await writeFile(join(source, "node_modules/dep/index.js"), "ignored");
    await Promise.all(
      Array.from({ length: 140 }, (_, index) =>
        writeFile(join(source, `src/nested/file-${index}.ts`), `export const value = ${index};\n`),
      ),
    );
    await writeFile(join(source, "src/run.sh"), "#!/bin/sh\nexit 0\n");
    await chmod(join(source, "src/run.sh"), 0o755);
    if (process.platform !== "win32") await symlink("nested/file-0.ts", join(source, "src/link.ts"));
    await cp(source, baseline, { recursive: true });
    await copyExtensionSource(source, target);
    expect(await readdir(join(target, "src/nested"))).toHaveLength(140);
    for (let index = 0; index < 140; index++) {
      expect(await readFile(join(target, `src/nested/file-${index}.ts`), "utf8")).toBe(
        `export const value = ${index};\n`,
      );
      expect(await readFile(join(source, `src/nested/file-${index}.ts`), "utf8")).toBe(
        `export const value = ${index};\n`,
      );
    }
    expect(await readFile(join(target, ".git/HEAD"), "utf8")).toBe("ref: refs/heads/main\n");
    expect((await readdir(target)).sort()).toEqual([".git", ".gitignore", "src"]);
    expect((await stat(join(target, "src/run.sh"))).mode).toBe((await stat(join(baseline, "src/run.sh"))).mode);
    expect((await stat(join(target, "src/nested"))).mode).toBe((await stat(join(baseline, "src/nested"))).mode);
    if (process.platform !== "win32") {
      expect((await lstat(join(target, "src/link.ts"))).isSymbolicLink()).toBe(true);
      expect(await readlink(join(target, "src/link.ts"))).toBe(await readlink(join(baseline, "src/link.ts")));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
