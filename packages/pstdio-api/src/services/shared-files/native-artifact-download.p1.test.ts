import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { storage_documents } from "pstdio-db";
import { NativeSourcePendingError } from "pstdio-sync";
import * as Y from "yjs";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { createSharedArtifactMount } from "./artifact-mount";

test.each([
  "existing",
  "new",
])("artifact refresh keeps downloading when %s file metadata arrives before its text", async (copy) => {
  const f = await artifactFilesFixture();
  try {
    const original = "---\r\ntitle: Keep\r\n---\r\n\r\nBody";
    await f.mount().writeText("waiting.md", original);
    const documentKey = "7".repeat(64);
    await f.storage.records.bindText({ recordId: f.recordId("documents/waiting.md"), documentKey, content: original });
    const text = f.deps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    const state = await text.exportUpdate();
    // Keep the received record and asset while its separately synced text has not arrived yet.
    await f.db
      .delete(storage_documents)
      .where(
        and(
          eq(storage_documents.workbench_id, f.owner.workbenchId),
          eq(storage_documents.extension_id, f.owner.extensionId),
          eq(storage_documents.document_id, JSON.stringify(["native-markdown", documentKey])),
        ),
      );
    const repoRoot = copy === "existing" ? f.input.repoRoot : join(f.root, "new-device");
    const directory = join(repoRoot, ".pstdio/extension-storage", f.owner.extensionId, "documents");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "outside.txt"), "Outside edit");
    const mount = createSharedArtifactMount(f.deps, { ...f.input, repoRoot });

    await mount.refresh();
    expect(await mount.readText("outside.txt")).toBe("Outside edit");
    expect(await Bun.file(f.pathFor("documents/waiting.md")).text()).toBe(original);
    expect(await Bun.file(join(directory, "waiting.md")).exists()).toBe(copy === "existing");
    await expect(text.read()).rejects.toBeInstanceOf(NativeSourcePendingError);

    const received = new Y.Doc();
    try {
      Y.applyUpdate(received, state);
      await text.applySource(received);
    } finally {
      received.destroy();
    }
    await mount.refresh();
    expect(await mount.readText("waiting.md")).toBe(original);
    expect(await Bun.file(join(directory, "waiting.md")).text()).toBe(original);
  } finally {
    await f.close();
  }
});

test("a pending child defers a concurrent ancestor replacement without blocking refresh", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.mount().writeText("group/waiting.md", "Keep this copy");
    const documentKey = "8".repeat(64);
    await f.storage.records.bindText({
      recordId: f.recordId("documents/group/waiting.md"),
      documentKey,
      content: "Keep this copy",
    });
    await f.db
      .delete(storage_documents)
      .where(
        and(
          eq(storage_documents.workbench_id, f.owner.workbenchId),
          eq(storage_documents.extension_id, f.owner.extensionId),
          eq(storage_documents.document_id, JSON.stringify(["native-markdown", documentKey])),
        ),
      );
    const open = f.deps.extensionStorageService.openNativeTextDocument;
    let replaced = false;
    f.deps.extensionStorageService.openNativeTextDocument = (input) => {
      const text = open(input);
      return {
        ...text,
        async read() {
          if (!replaced) {
            replaced = true;
            await f.replace("documents/group", "Replacement file");
          }
          return text.read();
        },
      };
    };

    await f.mount().refresh();
    expect(replaced).toBe(true);
    expect(await Bun.file(f.pathFor("documents/group/waiting.md")).text()).toBe("Keep this copy");
    expect((await f.storage.records.read(f.recordId("documents/group"))).value).toMatchObject({ kind: "file" });
    await writeFile(f.pathFor("documents/group/waiting.md"), "Outside while pending");
    await f.mount().refresh();
    expect(await Bun.file(f.pathFor("documents/group/waiting.md")).text()).toBe("Outside while pending");
    expect((await f.storage.records.read(f.recordId("documents/group"))).value).toMatchObject({ kind: "file" });
  } finally {
    await f.close();
  }
});
