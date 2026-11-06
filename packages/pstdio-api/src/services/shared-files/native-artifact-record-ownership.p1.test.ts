import { expect, test } from "bun:test";
import { sql, storage_ordered_operations } from "pstdio-db";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { withStorageObservation } from "./storage-observation";

test("projecting native file bytes does not author redundant ordered metadata saves", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount();
    await mount.writeText("note.md", "original");
    const recordId = f.recordId("documents/note.md");
    const source = await f.storage.records.bindText({ recordId, documentKey: "e".repeat(64), content: "original" });
    const text = f.deps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: source.documentKey });
    const authored = async () =>
      (await f.db.select({ count: sql<number>`count(*)::integer` }).from(storage_ordered_operations))[0]!.count;
    const before = await authored();
    const observed = await withStorageObservation({}, () => mount.readText("note.md"));
    await withStorageObservation(observed.versions, async () => {
      await mount.updateText("note.md", "first native edit");
      await mount.updateText("note.md", "second native edit");
      await mount.updateText("note.md", "second native edit");
    });
    expect(await text.read()).toBe("second native edit");
    expect(await mount.readText("note.md")).toBe("second native edit");
    expect(await authored()).toBe(before);
  } finally {
    await f.close();
  }
});

test("a native file metadata change remains ordered and stale file observations remain guarded", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount();
    await mount.writeText("note.md", "original");
    const recordId = f.recordId("documents/note.md");
    await f.storage.records.bindText({ recordId, documentKey: "f".repeat(64), content: "original" });
    const observed = await withStorageObservation({}, () => f.storage.records.read(recordId));
    const value = observed.value.value as { path: string };
    const updatedAt = "2026-11-05T00:00:00.000Z";
    await f.storage.records.writeTextAsset({ recordId, content: "changed", replace: { ...value, updatedAt } });
    expect((await f.storage.records.read(recordId)).value).toMatchObject({ updatedAt });
    await expect(
      withStorageObservation(observed.versions, () =>
        f.storage.records.writeTextAsset({ recordId, content: "must not replace", replace: value }),
      ),
    ).rejects.toThrow("changed since it was loaded");
    expect(await mount.readText("note.md")).toBe("changed");
  } finally {
    await f.close();
  }
});
