import { expect, test } from "bun:test";
import { join } from "node:path";
import { selected, textEditingFixture } from "./text-editing.test-fixture";

test("restoring a provider projects saved edits after all its editors closed", async () => {
  const failed = Promise.withResolvers<unknown>();
  const f = await textEditingFixture({ onDocumentLoadError: failed.resolve });
  try {
    const room = await f.documents.open({ projectId: "project-1", ...selected });
    await f.documents.close({ projectId: "project-1", roomId: room.roomId });
    f.setProviderEnabled(false);
    await f.deps.extensionRuntimeCatalog.get("project-1");
    const canonical = f.deps.extensionStorageService.openNativeTextDocument({
      owner: { workbenchId: "project-1", extensionId: "example.context" },
      fileId: room.documentKey,
    });
    await canonical.save("Saved while disabled");
    await failed.promise;
    expect(await Bun.file(join(f.root, "notes.txt")).text()).not.toBe("Saved while disabled");
    // A different live room makes startup-only recover() invalid here.
    const other = await f.documents.open({
      projectId: "project-1",
      extensionId: "thirdparty.editor",
      textDocument: { sourceId: "body", params: {} },
    });
    f.setProviderEnabled(true);
    const end = Date.now() + 1000;
    while ((await Bun.file(join(f.root, "notes.txt")).text()) !== "Saved while disabled" && Date.now() < end)
      await Bun.sleep(1);
    expect(await Bun.file(join(f.root, "notes.txt")).text()).toBe("Saved while disabled");
    await f.documents.close({ projectId: "project-1", roomId: other.roomId });
  } finally {
    await f.cleanup();
  }
});
