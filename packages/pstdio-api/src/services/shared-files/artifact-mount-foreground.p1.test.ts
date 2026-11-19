import { expect, test } from "bun:test";
import { mkdir, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createExtensionStorageDBService } from "pstdio-db";
import { PublicationUpdateRequiredError } from "../../features/extensions/publication/types";
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
    expect(await mount.statFile("note.md")).toMatchObject({ path: "note.md", size: 17 });
    expect(await mount.statFile("missing.md")).toBeUndefined();
    expect(await mount.readText("note.md")).toBe("selected document");
    const requested = new Set([f.recordId("documents/note.md"), f.recordId("documents/missing.md")]);
    expect(reads.filter((id) => !requested.has(id))).toEqual([]);
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

test("artifact lookups keep literal filenames and never create differently spelled records", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount();
    await mkdir(f.pathFor("documents/Folder"), { recursive: true });
    await writeFile(f.pathFor("documents/Folder/Report[1].txt"), "report");
    expect(await mount.statFile("Folder/Report[1].txt")).toMatchObject({ size: 6 });
    expect(await mount.statFile("Folder/report[1].txt")).toBeUndefined();
    expect(await mount.statFile("folder/missing.txt")).toBeUndefined();
    for (const path of ["Folder/report[1].txt", "folder"]) {
      expect((await f.storage.records.read(f.recordId(`documents/${path}`))).exists).toBe(false);
    }
  } finally {
    await f.close();
  }
});

test("artifact lookups follow only previously tracked links within the mount", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount();
    await mount.writeText("original.txt", "original");
    await mount.writeText("tracked.txt", "tracked");
    await symlink(f.pathFor("documents/original.txt"), f.pathFor("documents/untracked.txt"), "file");
    await rename(f.pathFor("documents/tracked.txt"), f.pathFor("documents/previous.txt"));
    await symlink(f.pathFor("documents/original.txt"), f.pathFor("documents/tracked.txt"), "file");
    expect(await mount.statFile("untracked.txt")).toBeUndefined();
    expect((await f.storage.records.read(f.recordId("documents/untracked.txt"))).exists).toBe(false);
    expect(await mount.statFile("tracked.txt")).toMatchObject({ size: 8 });
  } finally {
    await f.close();
  }
});

test("artifact lookup rejects a mount root linked outside the extension storage folder", async () => {
  const f = await artifactFilesFixture();
  try {
    const outside = join(f.root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "photo.txt"), "outside");
    await mkdir(f.pathFor(""), { recursive: true });
    await symlink(outside, f.pathFor("documents"), "junction");
    expect(await f.mount().statFile("photo.txt")).toBeUndefined();
    expect((await f.storage.records.read(f.recordId("documents/photo.txt"))).exists).toBe(false);
  } finally {
    await f.close();
  }
});

test("artifact lookup sees accepted remote files before materializing a replacement directory", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("item", "old file");
    await f.replace("documents/item", null);
    await f.replace("documents/item/photo.txt", "photo");
    const readOnly = createSharedArtifactMount(f.deps, {
      ...f.input,
      assertWritable: async () => {
        throw new PublicationUpdateRequiredError();
      },
    });
    expect(await readOnly.statFile("item/photo.txt")).toMatchObject({ size: 5 });
    expect(await Bun.file(f.pathFor("documents/item")).text()).toBe("old file");
    expect(await f.mount().statFile("item/photo.txt")).toMatchObject({ size: 5 });
    expect(await Bun.file(f.pathFor("documents/item/photo.txt")).text()).toBe("photo");
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
