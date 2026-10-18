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
    const conflicts = await f.storage.records.conflicts();
    expect(conflicts).toHaveLength(1);
    const branch = await f.storage.records.read(f.recordId("documents/note.md"), {
      operationId: conflicts[0]!.alternativeOperationIds[0]!,
    });
    expect(await new Response(await f.assets.read(f.owner, branch.asset!)).text()).toBe("saved during download");
    expect(await readFile(f.pathFor("documents/note.md"), "utf8")).toBe("remote replacement");
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

test("a stale native editor save keeps its original read baseline even if its handler reads fresh bytes", async () => {
  const { withStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "editor base");
    const loaded = await withStorageObservation({}, () => f.mount().readText("note.md"));
    await f.replace("documents/note.md", "remote saved edit");
    const saved = await withStorageObservation(loaded.versions, async () => {
      await f.mount().readText("note.md");
      await f.mount().writeText("note.md", "stale editor draft");
    });
    expect(saved.conflicted).toBe(true);
    expect(await f.mount().readText("note.md")).toBe("remote saved edit");
    expect(await f.storage.records.conflicts()).toHaveLength(1);
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
    expect(saved.conflicted).toBe(false);
    expect(await f.mount().readText("note.md")).toBe("second");
    expect(await f.storage.records.conflicts()).toEqual([]);
  } finally {
    await f.close();
  }
});

test("a different writer between a native handler's own writes still retains a conflict", async () => {
  const { withStorageObservation, withoutStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    const loaded = await withStorageObservation({}, () => f.mount().readText("note.md"));
    const saved = await withStorageObservation(loaded.versions, async () => {
      await f.mount().writeText("note.md", "first own save");
      await withoutStorageObservation(() => f.replace("documents/note.md", "another writer"));
      await f.mount().readText("note.md");
      await f.mount().writeText("note.md", "second own save");
    });
    expect(saved.conflicted).toBe(true);
    expect(await f.mount().readText("note.md")).toBe("another writer");
    expect(await f.storage.records.conflicts()).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test("a rejected stale delete cannot become a new deletion on the next refresh", async () => {
  const { withStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "base");
    const loaded = await withStorageObservation({}, () => f.mount().readText("note.md"));
    await f.replace("documents/note.md", "new saved edit");
    const deletion = await withStorageObservation(loaded.versions, () => f.mount().delete("note.md"));
    expect(deletion.conflicted).toBe(true);
    await f.mount().refresh();
    expect(await f.mount().readText("note.md")).toBe("new saved edit");
    expect(await f.storage.records.conflicts()).toHaveLength(1);
  } finally {
    await f.close();
  }
});

test("loaded bytes retain the revision of their immutable asset during a concurrent update", async () => {
  const { withStorageObservation, withoutStorageObservation } = await import("./storage-observation");
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "loaded bytes");
    let change = true;
    const mount = createSharedArtifactMount(
      {
        ...f.deps,
        assetTransferService: {
          ...f.assets,
          read: async (...args: Parameters<typeof f.assets.read>) => {
            if (change) {
              change = false;
              await withoutStorageObservation(() => f.replace("documents/note.md", "concurrent edit"));
            }
            return f.assets.read(...args);
          },
        },
      },
      f.input,
    );
    const loaded = await withStorageObservation({}, () => mount.readText("note.md"));
    expect(loaded.value).toBe("loaded bytes");
    const saved = await withStorageObservation(loaded.versions, () =>
      mount.writeText("note.md", "draft from loaded bytes"),
    );
    expect(saved.conflicted).toBe(true);
    expect(await f.mount().readText("note.md")).toBe("concurrent edit");
  } finally {
    await f.close();
  }
});

for (const replacement of ["remote bytes", null])
  test(`replaying a projected ${replacement === null ? "deletion" : "file"} after an interrupted checkpoint creates no conflict`, async () => {
    const f = await artifactFilesFixture();
    try {
      await f.mount().writeText("note.md", "base");
      const projection = fileProjection(JSON.stringify([f.owner, f.pathFor("")]));
      const baseline = await projection.read();
      await f.replace("documents/note.md", replacement);
      await f.mount().refresh();
      await projection.write(baseline);
      await f.mount().refresh();
      expect(await f.storage.records.conflicts()).toEqual([]);
      expect((await f.storage.readState()).journal).toHaveLength(2);
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
