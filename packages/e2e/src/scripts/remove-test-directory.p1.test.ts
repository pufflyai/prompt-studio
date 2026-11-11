import { expect, test } from "bun:test";
import { chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTestDirectory } from "./remove-test-directory";

test("removes its owned tree without following directory links or deleting external hardlinks", async () => {
  const parent = await mkdtemp(join(tmpdir(), "owned-cleanup-"));
  try {
    const owned = join(parent, "owned ' $` Ω");
    const external = join(parent, "external");
    await mkdir(owned);
    await mkdir(external);
    const sentinel = join(external, "keep.txt");
    await writeFile(sentinel, "Keep the external target");
    await symlink(external, join(owned, "external-directory"), process.platform === "win32" ? "junction" : "dir");
    await link(sentinel, join(owned, "external-file"));
    await writeFile(join(owned, "own.txt"), "Remove this owned file");

    await removeTestDirectory(owned);

    expect(await stat(owned).catch(() => null)).toBeNull();
    expect(await readFile(sentinel, "utf8")).toBe("Keep the external target");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("removes readonly files and long Unicode paths, and accepts an already removed root", async () => {
  const parent = await mkdtemp(join(tmpdir(), "attribute-cleanup-"));
  const owned = join(parent, "owned");
  try {
    const deep = join(owned, ...Array.from({ length: 14 }, (_, index) => `directory-${index}-long-Ω`));
    await mkdir(deep, { recursive: true });
    const file = join(deep, "readonly.txt");
    await writeFile(file, "Read only");
    await chmod(file, 0o444);

    await removeTestDirectory(owned);
    await removeTestDirectory(owned);

    expect(await stat(owned).catch(() => null)).toBeNull();
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("removes a linked root without enumerating its external target", async () => {
  const parent = await mkdtemp(join(tmpdir(), "linked-root-cleanup-"));
  try {
    const external = join(parent, "external");
    await mkdir(external);
    await writeFile(join(external, "keep.txt"), "Keep the external target");
    const owned = join(parent, "owned-link");
    await symlink(external, owned, process.platform === "win32" ? "junction" : "dir");
    await removeTestDirectory(owned);
    expect(await stat(owned).catch(() => null)).toBeNull();
    expect(await readFile(join(external, "keep.txt"), "utf8")).toBe("Keep the external target");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
