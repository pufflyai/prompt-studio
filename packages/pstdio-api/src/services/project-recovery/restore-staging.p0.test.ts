import { afterEach, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecoveryStagingJournal } from "./restore-staging";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("a later start removes staging a crashed restore left, but never a folder that replaced it", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-staging-"));
  roots.push(root);
  const work = join(root, "recovery");
  const journal = createRecoveryStagingJournal(work);
  const abandoned = join(root, ".restored.pstdio-restore-a");
  await mkdir(join(abandoned, "readonly"), { recursive: true });
  await writeFile(join(abandoned, "readonly/file"), "partial");
  await chmod(join(abandoned, "readonly"), 0o500);
  // The restores ended without removing their staging, as when a process crashes.
  (await journal.record(abandoned)).release();
  const replaced = join(root, ".restored.pstdio-restore-b");
  await mkdir(replaced);
  (await journal.record(replaced)).release();
  await rm(replaced, { recursive: true });
  await mkdir(join(root, "work"));
  await writeFile(join(root, "work", "file"), "someone else's folder");
  await symlink(join(root, "work"), replaced);
  // Both entries now belong to a process that exited.
  for (const name of await readdir(join(work, "restores"))) {
    const file = join(work, "restores", name);
    await writeFile(file, JSON.stringify({ ...JSON.parse(await readFile(file, "utf8")), pid: 2 ** 22 + 1 }));
  }
  await journal.clean();
  expect((await readdir(root)).sort()).toEqual([".restored.pstdio-restore-b", "recovery", "work"]);
  expect(await readFile(join(root, "work", "file"), "utf8")).toBe("someone else's folder");
  expect(await readdir(join(work, "restores"))).toEqual([]);
});
