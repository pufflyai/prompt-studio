import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { createSharedArtifactMount } from "./artifact-mount";
import { fileProjection } from "./file-state";

test("an editor save during remote download is retained before incoming bytes replace the file", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    await f.replace("documents/note.md", "remote replacement");
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let pause = true;
    const assets = {
      ...f.assets,
      read: async (...args: Parameters<typeof f.assets.read>) => {
        if (pause) {
          pause = false;
          started.resolve();
          await release.promise;
        }
        return f.assets.read(...args);
      },
    };
    const mount = createSharedArtifactMount(
      { extensionStorageService: f.deps.extensionStorageService, assetTransferService: assets },
      { ...f.input },
    );
    const refresh = mount.refresh();
    await started.promise;
    await writeFile(f.pathFor("documents/note.md"), "saved during download");
    release.resolve();
    await refresh;
    expect(await f.mount().readText("note.md")).toBe("saved during download");
    expect(await readFile(f.pathFor("documents/note.md"), "utf8")).toBe("saved during download");
  } finally {
    await f.close();
  }
});

test("materialization checks workspace write permission even for an ordinary read", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "local readable copy");
    const mount = createSharedArtifactMount(f.deps, {
      ...f.input,
      resolveWriteRoot: async () => {
        throw new Error("Workspace provider does not allow file write access.");
      },
    });
    expect(await mount.readText("note.md")).toBe("local readable copy");
    await f.replace("documents/note.md", "incoming remote change");
    await expect(mount.readText("note.md")).rejects.toThrow("does not allow file write access");
    expect(await readFile(f.pathFor("documents/note.md"), "utf8")).toBe("local readable copy");
  } finally {
    await f.close();
  }
});

test("one native save can write a file more than once without conflicting with its own writes", async () => {
  const { withStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    const loaded = await withStorageObservation({}, () => f.mount().readText("note.md"));
    const saved = await withStorageObservation(loaded.versions, async () => {
      await f.mount().writeText("note.md", "first");
      await f.mount().writeText("note.md", "second");
    });
    expect(Object.keys(saved.versions).length).toBeGreaterThan(0);
    expect(await f.mount().readText("note.md")).toBe("second");
    expect(await f.storage.records.conflicts()).toEqual([]);
  } finally {
    await f.close();
  }
});

test("a native save refuses to overwrite an outside edit made since its load", async () => {
  const { withStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    const loaded = await withStorageObservation({}, () => f.mount().readText("note.md"));
    await writeFile(f.pathFor("documents/note.md"), "outside edit");
    await expect(
      withStorageObservation(loaded.versions, () => f.mount().writeText("note.md", "stale editor text")),
    ).rejects.toThrow("changed since it was loaded");
    expect(await f.mount().readText("note.md")).toBe("outside edit");
    expect(await readFile(f.pathFor("documents/note.md"), "utf8")).toBe("outside edit");
  } finally {
    await f.close();
  }
});

test("a native save rechecks its loaded revision after staging bytes", async () => {
  const { withStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    const loaded = await withStorageObservation({}, () => f.mount().readText("note.md"));
    const staging = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const mount = createSharedArtifactMount(
      {
        ...f.deps,
        assetTransferService: {
          ...f.assets,
          stage: async (...args: Parameters<typeof f.assets.stage>) => {
            const asset = await f.assets.stage(...args);
            staging.resolve();
            await resume.promise;
            return asset;
          },
        },
      },
      f.input,
    );
    const saved = withStorageObservation(loaded.versions, () => mount.writeText("note.md", "stale text"));
    void saved.catch(() => {});
    await staging.promise;
    try {
      await f.replace("documents/note.md", "concurrent record edit");
    } finally {
      resume.resolve();
    }
    await expect(saved).rejects.toThrow("changed since it was loaded");
    expect(await f.mount().readText("note.md")).toBe("concurrent record edit");
  } finally {
    await f.close();
  }
});

for (const replacement of ["remote bytes", null])
  test(`replaying a projected ${replacement === null ? "deletion" : "file"} after an interrupted checkpoint creates no conflict`, async () => {
    const f = await artifactFilesFixture();
    try {
      await f.mount().writeText("note.md", "base");
      const projection = fileProjection(
        JSON.stringify([f.owner, f.pathFor("")]),
        f.deps.extensionStorageService.fileProjections,
      );
      const baseline = await projection.read();
      await f.replace("documents/note.md", replacement);
      await f.mount().refresh();
      await projection.write(baseline);
      await f.mount().refresh();
      expect(await f.storage.records.conflicts()).toEqual([]);
      expect(await f.mount().exists("note.md")).toBe(replacement !== null);
    } finally {
      await f.close();
    }
  });

test("a download rechecks workspace permission before installing its bytes", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    await f.replace("documents/note.md", "remote bytes");
    let writable = true;
    const mount = createSharedArtifactMount(
      {
        ...f.deps,
        assetTransferService: {
          ...f.assets,
          read: async (...args: Parameters<typeof f.assets.read>) => {
            writable = false;
            return f.assets.read(...args);
          },
        },
      },
      {
        ...f.input,
        resolveWriteRoot: async () => {
          if (!writable) throw new Error("Workspace is now read-only");
          return f.input.repoRoot;
        },
      },
    );
    await expect(mount.refresh()).rejects.toThrow("now read-only");
    expect(await readFile(f.pathFor("documents/note.md"), "utf8")).toBe("base");
  } finally {
    await f.close();
  }
});
