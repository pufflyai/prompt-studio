import { expect, test } from "bun:test";
import { rename } from "node:fs/promises";
import { artifactFilesFixture } from "./artifact-files.fixture";

test("a stable native source keeps its edits when its physical artifact path changes", async () => {
  const f = await artifactFilesFixture();
  try {
    const mount = f.mount(),
      documentKey = "6".repeat(64);
    await mount.writeText("before.md", "abc");
    await f.storage.records.bindText({ recordId: f.recordId("documents/before.md"), documentKey, content: "abc" });
    const text = f.deps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    await text.save("PEER abc");
    expect(await mount.readText("before.md")).toBe("PEER abc");
    await rename(f.pathFor("documents/before.md"), f.pathFor("documents/after.md"));
    await mount.refresh();
    await f.storage.records.bindText({ recordId: f.recordId("documents/after.md"), documentKey, content: "PEER abc" });
    const actual = await mount.readText("after.md");
    console.log("renamed artifact:", JSON.stringify(actual), "native:", JSON.stringify(await text.read()));
    expect(actual).toBe("PEER abc");
    expect(await text.read()).toBe("PEER abc");
  } finally {
    await f.close();
  }
});
