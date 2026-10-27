import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { artifactFilesFixture } from "./artifact-files.fixture";

test("a bound artifact projects peer text once and merges outside edits against its physical copy", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount();
    await mount.writeText("note.md", "abc");
    const documentKey = "1".repeat(64);
    await f.storage.records.bindText({ recordId: f.recordId("documents/note.md"), documentKey, content: "abc" });
    const text = f.deps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    await text.save("PEER abc");
    expect(await mount.readText("note.md")).toBe("PEER abc");
    expect(await Bun.file(f.pathFor("documents/note.md")).text()).toBe("PEER abc");
    await text.save("PEER abc LOCAL");
    await writeFile(f.pathFor("documents/note.md"), "OUTSIDE abc");
    expect(await mount.readText("note.md")).toBe("OUTSIDE abc LOCAL");
    await mount.updateText("note.md", "saved through the artifact API");
    expect(await text.read()).toBe("saved through the artifact API");
    expect(await mount.readText("note.md")).toBe("saved through the artifact API");
  } finally {
    await f.close();
  }
});

test("a file source declaration cannot bind transformed bytes as the original asset", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("note.md", "---\ntitle: Keep\n---\n\nBody");
    await expect(
      f.storage.records.bindText({
        recordId: f.recordId("documents/note.md"),
        documentKey: "3".repeat(64),
        content: "Body",
      }),
    ).rejects.toThrow("full source");
    expect(await f.mount().readText("note.md")).toBe("---\ntitle: Keep\n---\n\nBody");
  } finally {
    await f.close();
  }
});

test("binding a stale original asset uses its genesis history without deleting later shared text", async () => {
  const f = await artifactFilesFixture();
  try {
    const documentKey = "9".repeat(64);
    const text = f.deps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    await text.seed("abc");
    await text.save("PEER abc");
    const mount = f.mount();
    await mount.writeText("stale.md", "abc");
    await f.storage.records.bindText({ recordId: f.recordId("documents/stale.md"), documentKey, content: "abc" });
    expect(await mount.readText("stale.md")).toBe("PEER abc");
    expect(await text.read()).toBe("PEER abc");
  } finally {
    await f.close();
  }
});
