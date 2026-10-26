import { expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { createSharedArtifactMount } from "./artifact-mount";

test("independent offline children of an existing directory merge without a conflict", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("folder/base.md", "base");
    const peerRoot = join(f.root, "peer");
    const peerPath = join(peerRoot, ".pstdio/extension-storage/example.documents/documents/folder");
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
