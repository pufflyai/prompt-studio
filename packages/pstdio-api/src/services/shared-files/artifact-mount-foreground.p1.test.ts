import { expect, test } from "bun:test";
import { createExtensionStorageDBService } from "pstdio-db";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { createSharedArtifactMount } from "./artifact-mount";
import { storageObserver } from "./storage-observation";

test("opening one artifact file leaves unrelated records alone", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "selected document");
    await f.storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: Array.from({ length: 10 }, (_, index) => ({
        recordId: `unrelated-${index}`,
        replace: { title: `Resource ${index}` },
      })),
    });
    for (let index = 0; index < 10; index++) await f.replace(`documents/other-${index}.md`, `Other file ${index}`);
    const reads: string[] = [];
    const storage = createExtensionStorageDBService(f.db, {
      ...storageObserver,
      read(owner, record) {
        reads.push(record.recordId);
        storageObserver.read(owner, record);
      },
    });
    const mount = createSharedArtifactMount({ ...f.deps, extensionStorageService: storage }, f.input);
    expect(await mount.readText("note.md")).toBe("selected document");
    expect(reads.filter((id) => id !== f.recordId("documents/note.md"))).toEqual([]);
    expect(await Bun.file(f.pathFor("documents/other-0.md")).exists()).toBe(false);
    reads.length = 0;
    await mount.writeText("note.md", "edited document");
    expect(await mount.readText("note.md")).toBe("edited document");
    expect(await mount.exists("note.md")).toBe(true);
    expect(reads.filter((id) => id !== f.recordId("documents/note.md"))).toEqual([]);
    expect(await Bun.file(f.pathFor("documents/other-0.md")).exists()).toBe(false);
  } finally {
    await f.close();
  }
});

test("a point read clears an incoming file's old directory descendants without hydrating other files", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("item/note.md", "old child");
    await f.replace("documents/item/note.md", null);
    await f.replace("documents/item", "new flat file");
    await f.replace("documents/unrelated.md", "another file");
    expect(await f.mount().readText("item")).toBe("new flat file");
    expect(await Bun.file(f.pathFor("documents/item/note.md")).exists()).toBe(false);
    expect(await Bun.file(f.pathFor("documents/unrelated.md")).exists()).toBe(false);
  } finally {
    await f.close();
  }
});
