import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileMount } from "pstdio-extensions";
import { createObservedFileMount } from "./observed-file-mount";
import { withStorageObservation } from "./storage-observation";

test("observed text reads preserve the ordinary mount's BOM and invalid-byte decoding", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-observed-file-"));
  try {
    const files = createFileMount(root);
    await files.writeBytes("note.md", new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0xff]));
    const mount = createObservedFileMount(root, files);
    const observed = await withStorageObservation({}, () => mount.readText("note.md"));
    expect(observed.value).toBe(await files.readText("note.md"));
    expect(observed.value).toBe("\ufeffa\ufffd");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const operation of ["exists", "readText", "readBytes"] as const) {
  test(`a missing workspace source observed by ${operation} protects an outside file creation`, async () => {
    const root = await mkdtemp(join(tmpdir(), "native-observed-file-"));
    try {
      const mount = createObservedFileMount(root, createFileMount(root));
      const loaded = await withStorageObservation({}, async () => {
        await mount[operation]("new.md").catch(() => undefined);
      });
      await writeFile(join(root, "new.md"), "outside creation");
      await expect(
        withStorageObservation(loaded.versions, () => mount.writeText("new.md", "stale empty source")),
      ).rejects.toThrow("changed since it was loaded");
      expect(await readFile(join(root, "new.md"), "utf8")).toBe("outside creation");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("an outside edit immediately after a workspace write never becomes that save's own baseline", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-observed-file-"));
  try {
    const files = createFileMount(root);
    await files.writeText("note.md", "base");
    let inject = true;
    const mount = createObservedFileMount(root, {
      ...files,
      writeText: async (path, text) => {
        await files.writeText(path, text);
        if (inject) {
          inject = false;
          await writeFile(join(root, path), "outside edit");
        }
      },
    });
    const loaded = await withStorageObservation({}, () => mount.readText("note.md"));
    await expect(
      withStorageObservation(loaded.versions, async () => {
        await mount.writeText("note.md", "own first");
        await mount.writeText("note.md", "own later stale");
      }),
    ).rejects.toThrow("changed since it was loaded");
    expect(await readFile(join(root, "note.md"), "utf8")).toBe("outside edit");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
