import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageFilesMatch, packExtension, unpackExtension } from "./package";

test("published packages preserve exact files, omit local inputs, and reject links", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-package-"));
  try {
    const source = join(root, "source");
    await mkdir(join(source, "node_modules"), { recursive: true });
    await writeFile(join(source, "package.json"), '{"name":"unrelated"}');
    await writeFile(join(source, "image.bin"), new Uint8Array([0, 255, 42]));
    await writeFile(join(source, ".env"), "PRIVATE=secret");
    await writeFile(join(source, "node_modules", "local.ts"), "private");
    await writeFile(join(source, ".npmrc"), "//registry.npmjs.org/:_authToken=fixture-secret");
    await writeFile(join(source, ".yarnrc.yml"), "npmAuthToken: fixture-secret");
    await writeFile(join(source, "run"), "portable executable", { mode: 0o755 });
    const first = await packExtension(source);
    const target = join(root, "target");
    await unpackExtension(first, target);
    expect(await readFile(join(target, "image.bin"))).toEqual(Buffer.from([0, 255, 42]));
    expect(await packExtension(target)).toEqual(first);
    expect((await stat(join(target, "run"))).mode & 0o111).toBe((await stat(join(source, "run"))).mode & 0o111);
    expect(await first.text()).not.toContain("fixture-secret");
    expect(await Bun.file(join(target, ".env")).exists()).toBe(false);
    expect(await Bun.file(join(target, "node_modules", "local.ts")).exists()).toBe(false);
    await symlink(join(source, "image.bin"), join(source, "linked.bin"));
    await expect(packExtension(source)).rejects.toThrow("symbolic link");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package extraction rejects traversal and duplicate paths before writing files", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-package-paths-"));
  try {
    for (const files of [
      [{ path: "../outside", bytes: "", executable: false }],
      [
        { path: "a", bytes: "", executable: false },
        { path: "a", bytes: "", executable: false },
      ],
      [{ path: "C:/outside", bytes: "", executable: false }],
    ]) {
      await expect(
        unpackExtension(new Blob([JSON.stringify({ version: 1, files })]), join(root, "stage")),
      ).rejects.toThrow();
      expect(await Bun.file(join(root, "outside")).exists()).toBe(false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cross-platform source comparison preserves executable package bytes without treating missing Windows mode bits as edits", async () => {
  const archive = (executable: boolean) =>
    new Blob([JSON.stringify({ version: 1, files: [{ path: "run", bytes: "YQ==", executable }] })]);
  expect(await packageFilesMatch(archive(true), archive(false), "win32")).toBe(true);
  expect(await packageFilesMatch(archive(true), archive(false), "linux")).toBe(false);
});
