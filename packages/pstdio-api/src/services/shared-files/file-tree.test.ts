import { expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { createSharedArtifactMount } from "./artifact-mount";

test("competing offline file and directory creations retain a conflict and project a valid tree", async () => {
  const f = await artifactFilesFixture();
  try {
    const peerRoot = join(f.root, "peer");
    const peerPath = join(peerRoot, ".pstdio/extension-storage/example-documents/documents");
    const peer = createSharedArtifactMount(f.deps, { ...f.input, repoRoot: peerRoot });
    await f.mount().refresh();
    await peer.refresh();
    await mkdir(f.pathFor("documents"), { recursive: true });
    await writeFile(f.pathFor("documents/item"), "first environment file");
    await mkdir(join(peerPath, "item"), { recursive: true });
    await writeFile(join(peerPath, "item/child.md"), "second environment child");
    await f.mount().refresh();
    await peer.refresh();
    expect(await peer.readText("item")).toBe("first environment file");
    const conflicts = await f.storage.records.conflicts();
    expect(conflicts).toHaveLength(1);
    const alternative = await f.storage.records.read(f.recordId("documents/item/child.md"), {
      operationId: conflicts[0]!.alternativeOperationIds[0]!,
    });
    expect(await new Response(await f.assets.read(f.owner, alternative.asset!)).text()).toBe(
      "second environment child",
    );
  } finally {
    await f.close();
  }
});

test("independent offline children of an existing directory merge without a conflict", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("folder/base.md", "base");
    const peerRoot = join(f.root, "peer");
    const peerPath = join(peerRoot, ".pstdio/extension-storage/example-documents/documents/folder");
    const peer = createSharedArtifactMount(f.deps, { ...f.input, repoRoot: peerRoot });
    await peer.refresh();
    await writeFile(f.pathFor("documents/folder/a.md"), "A");
    await writeFile(join(peerPath, "b.md"), "B");
    await f.mount().refresh();
    await peer.refresh();
    await f.mount().refresh();
    expect(await f.storage.records.conflicts()).toEqual([]);
    expect(await peer.readText("folder/a.md")).toBe("A");
    expect(await f.mount().readText("folder/b.md")).toBe("B");
  } finally {
    await f.close();
  }
});

test("a directory deletion cannot discard an offline new child", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("folder/base.md", "base");
    const peerRoot = join(f.root, "peer");
    const peer = createSharedArtifactMount(f.deps, { ...f.input, repoRoot: peerRoot });
    await peer.refresh();
    await rm(f.pathFor("documents/folder"), { recursive: true });
    const child = join(peerRoot, ".pstdio/extension-storage/example-documents/documents/folder/new.md");
    await writeFile(child, "offline child");
    await f.mount().refresh();
    await peer.refresh();
    expect(await f.storage.records.conflicts()).toHaveLength(1);
    expect(await peer.exists("folder")).toBe(false);
    const conflicts = await f.storage.records.conflicts();
    const branch = await f.storage.records.read(f.recordId("documents/folder/new.md"), {
      operationId: conflicts[0]!.alternativeOperationIds[0]!,
    });
    expect(await new Response(await f.assets.read(f.owner, branch.asset!)).text()).toBe("offline child");
  } finally {
    await f.close();
  }
});

test("empty directories and their deletion survive materialization", async () => {
  const f = await artifactFilesFixture();
  try {
    await mkdir(f.pathFor("documents/empty"), { recursive: true });
    await f.mount().refresh();
    await rm(f.pathFor("documents/empty"), { recursive: true });
    // Recreating the materialized tree from its journal restores the empty directory.
    const peerRoot = join(f.root, "peer");
    const peer = createSharedArtifactMount(f.deps, { ...f.input, repoRoot: peerRoot });
    expect(await peer.listDirs()).toEqual(["empty"]);
    await peer.delete("empty");
    expect(await peer.exists("empty")).toBe(false);
    expect(await readFile(f.pathFor("documents/empty")).catch(() => null)).toBeNull();
  } finally {
    await f.close();
  }
});

for (const first of ["file", "directory"] as const)
  for (const choose of ["local", "remote"] as const) {
    test(`a ${first} winner and its conflicting tree resolve using the ${choose} choice`, async () => {
      const f = await artifactFilesFixture();
      try {
        const peerRoot = join(f.root, "peer");
        const peerPath = join(peerRoot, ".pstdio/extension-storage/example-documents/documents");
        const peer = createSharedArtifactMount(f.deps, { ...f.input, repoRoot: peerRoot });
        await f.mount().refresh();
        await peer.refresh();
        const fileRoot = first === "file" ? f.pathFor("documents") : peerPath;
        const dirRoot = first === "file" ? peerPath : f.pathFor("documents");
        await mkdir(fileRoot, { recursive: true });
        await writeFile(join(fileRoot, "item"), "flat file");
        await mkdir(join(dirRoot, "item"), { recursive: true });
        await writeFile(join(dirRoot, "item/child.md"), "nested child");
        await f.mount().refresh();
        await peer.refresh();
        const conflict = (await f.storage.records.conflicts())[0]!;
        const inspection = await f.storage.records.inspect(conflict.conflictId);
        await f.storage.records.resolve({ ...inspection, operationId: crypto.randomUUID(), choose });
        await f.mount().refresh();
        await peer.refresh();
        const directory = choose === "local" ? first === "file" : first === "directory";
        if (directory) expect(await peer.readText("item/child.md")).toBe("nested child");
        else expect(await peer.readText("item")).toBe("flat file");
        expect(await f.storage.records.conflicts()).toEqual([]);
      } finally {
        await f.close();
      }
    });
  }

for (const choose of ["local", "remote"] as const)
  test(`an offline child versus directory deletion resolves to ${choose}`, async () => {
    const f = await artifactFilesFixture();
    try {
      await f.mount().writeText("folder/base.md", "base");
      const peerRoot = join(f.root, "peer");
      const peer = createSharedArtifactMount(f.deps, { ...f.input, repoRoot: peerRoot });
      await peer.refresh();
      await rm(f.pathFor("documents/folder"), { recursive: true });
      await writeFile(
        join(peerRoot, ".pstdio/extension-storage/example-documents/documents/folder/new.md"),
        "offline child",
      );
      await f.mount().refresh();
      await peer.refresh();
      const conflict = (await f.storage.records.conflicts())[0]!;
      const inspection = await f.storage.records.inspect(conflict.conflictId);
      await f.storage.records.resolve({ ...inspection, operationId: crypto.randomUUID(), choose });
      if (choose === "local") expect(await peer.readText("folder/new.md")).toBe("offline child");
      else expect(await peer.exists("folder")).toBe(false);
      expect(await f.storage.records.conflicts()).toEqual([]);
    } finally {
      await f.close();
    }
  });

test("a recreated directory cannot revive children from a previous directory lifetime", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("folder/old.md", "old child");
    const folder = await f.storage.records.read(f.recordId("documents/folder"));
    await f.storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: [{ recordId: folder.recordId, expectedRevision: folder.revision, deleted: true, asset: null }],
    });
    await f.mount().refresh();
    await f.mount().writeText("folder/new.md", "new child");
    expect(await f.mount().exists("folder/old.md")).toBe(false);
    expect(await f.mount().readText("folder/new.md")).toBe("new child");
  } finally {
    await f.close();
  }
});

test("adding a nested mount alias preserves the existing directory identity", async () => {
  const f = await artifactFilesFixture();
  try {
    const original = createSharedArtifactMount(f.deps, { ...f.input, mountPaths: ["documents"] });
    await original.writeText("nested/note.md", "saved through original mount");
    const before = await f.storage.records.read(f.recordId("documents/nested"));
    expect(await f.mount("documents/nested").readText("note.md")).toBe("saved through original mount");
    expect((await f.storage.records.read(f.recordId("documents/nested"))).value).toEqual(before.value);
    await expect(f.mount().writeText("nested", "overwrite declared root")).rejects.toThrow();
    await expect(f.mount().delete("nested")).rejects.toThrow();
  } finally {
    await f.close();
  }
});
