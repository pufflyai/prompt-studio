import { expect, test } from "bun:test";
import { artifactFilesFixture } from "./artifact-files.fixture";

test("a deleted bound artifact can be recreated through its normal file API", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount();
    await mount.writeText("note.md", "original");
    await f.storage.records.bindText({
      recordId: f.recordId("documents/note.md"),
      documentKey: "4".repeat(64),
      content: "original",
    });
    await mount.readText("note.md");
    await mount.delete("note.md");
    expect(await mount.exists("note.md")).toBe(false);
    let rejected: unknown;
    try {
      await mount.writeText("note.md", "recreated");
    } catch (error) {
      rejected = error;
    }
    console.log("recreation failure:", String(rejected));
    expect(rejected).toBeUndefined();
    expect(await mount.readText("note.md")).toBe("recreated");
  } finally {
    await f.close();
  }
});
