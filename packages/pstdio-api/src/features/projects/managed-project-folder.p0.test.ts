import { expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectManagedProjectFolder,
  prepareManagedProjectFolder,
  removeManagedProjectFolder,
} from "./managed-project-folder";

test("a failed ownership record can be retried without leaving an unowned app-created folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-folder-ownership-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const id = "downloaded-project";
  const folder = join(root, "projects", `project-${id}`);
  const ownership = join(root, "project-folder-ownership");
  try {
    await writeFile(ownership, "Prevent ownership recording");
    await expect(prepareManagedProjectFolder(id)).rejects.toBeDefined();
    await expect(lstat(folder)).rejects.toMatchObject({ code: "ENOENT" });
    await rm(ownership);
    const prepared = await prepareManagedProjectFolder(id);
    expect(await inspectManagedProjectFolder(id, prepared)).toEqual({ removesManagedFolder: true });
    await removeManagedProjectFolder(id, prepared);
    await expect(lstat(folder)).rejects.toMatchObject({ code: "ENOENT" });
    await mkdir(folder);
    await writeFile(join(folder, "user.txt"), "Keep pre-existing files");
    await prepareManagedProjectFolder(id);
    await removeManagedProjectFolder(id, prepared);
    expect(await readFile(join(folder, "user.txt"), "utf8")).toBe("Keep pre-existing files");
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});
