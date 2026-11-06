import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openRecoverySource } from "./source-posix";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("held source directories never descend through a replaced parent symlink", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-source-"));
  roots.push(root);
  await mkdir(join(root, "selected/child"), { recursive: true });
  await mkdir(join(root, "outside"));
  await writeFile(join(root, "selected/child/value"), "selected bytes");
  await writeFile(join(root, "outside/value"), "unrelated bytes");
  const source = await openRecoverySource(join(root, "selected"));
  try {
    const child = await source.root.open("child", true);
    try {
      await rename(join(root, "selected/child"), join(root, "selected/original"));
      await symlink("../outside", join(root, "selected/child"));
      const value = await child.open("value", true);
      try {
        const bytes = new Uint8Array(64);
        expect(new TextDecoder().decode(bytes.subarray(0, await value.read(bytes, 0)))).toBe("selected bytes");
      } finally {
        value.close();
      }
      const replaced = await source.root.open("child");
      try {
        expect((await replaced.stat()).isSymbolicLink()).toBe(true);
      } finally {
        replaced.close();
      }
      await expect(source.root.open("child", true)).rejects.toThrow();
    } finally {
      child.close();
    }
  } finally {
    source.close();
  }
});

test("source enumeration preserves UTF-8 names and link target text without reading its target", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-source-"));
  roots.push(root);
  await writeFile(join(root, "café.txt"), "saved");
  await symlink("/missing/private-target", join(root, "external"));
  const source = await openRecoverySource(root);
  try {
    expect([...source.root.children()].sort()).toEqual(["café.txt", "external"]);
    expect(source.root.readlink("external")).toBe("/missing/private-target");
    await expect(source.root.open("../outside")).rejects.toThrow();
  } finally {
    source.close();
  }
});

test("failed starter-policy preparation never leaves a partial policy in the source folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-policy-publication-"));
  roots.push(root);
  await mkdir(join(root, "source"));
  const blockedStage = join(root, "not-a-directory");
  await writeFile(blockedStage, "existing work");
  const source = await openRecoverySource(join(root, "source"));
  try {
    await expect(
      source.root.create(".pstignore", new TextEncoder().encode("node_modules/\n"), blockedStage),
    ).rejects.toThrow();
    expect(await readFile(join(root, "source/.pstignore")).catch((error) => error.code)).toBe("ENOENT");
    expect(await readFile(blockedStage, "utf8")).toBe("existing work");
  } finally {
    source.close();
  }
});
