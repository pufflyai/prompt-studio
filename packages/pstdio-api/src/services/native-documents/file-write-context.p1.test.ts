import { expect, test } from "bun:test";
import { artifactFilesFixture } from "../shared-files/artifact-files.fixture";
import { prepareNativeFileWrite, withNativeFileWrite } from "./file-write-context";

test("preparing an identical UTF-8 write preserves the canonical BOM", async () => {
  const f = await artifactFilesFixture();
  try {
    const storage = f.deps.extensionStorageService;
    const documentKey = "b".repeat(64);
    const projectionKey = JSON.stringify(["workspace-file", f.root, "note.md"]);
    const source = "\uFEFFbody";
    const text = storage.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    await text.seed(source);
    const state = await text.exportUpdate();
    await storage.nativeFileProjections.initialize({ owner: f.owner, documentKey, projectionKey, state });
    const write = await withNativeFileWrite({ storage, owner: f.owner, documentKey, projectionKey, state }, () =>
      prepareNativeFileWrite(projectionKey, new TextEncoder().encode(source)),
    );
    expect(write).toBeDefined();
    expect(await text.read()).toBe(source);
    await write!.written();
    expect(await text.read()).toBe(source);
  } finally {
    await f.close();
  }
});
