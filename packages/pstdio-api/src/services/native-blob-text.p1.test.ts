import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { storageRecordId } from "pstdio-sync";
import { blobFilesFixture } from "./shared-files/blob-files.fixture";

test("updating a shared blob retains its identity and serves its current native text", async () => {
  const f = await blobFilesFixture();
  try {
    const file = (await f.service.upload({ ...f.scope, file_name: "note.md", data: Buffer.from("original") }))!;
    const ref = { ...f.scope, file_id: file.id };
    const documentKey = "2".repeat(64);
    await f.storage.records.bindText({
      recordId: storageRecordId(["blob-file"], file.id),
      documentKey,
      content: "original",
    });
    const text = f.fileDeps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: documentKey });
    await text.save("peer content");
    const peer = (await f.service.getOwnedFile(ref))!;
    expect(await new Response(await f.service.read(peer)).text()).toBe("peer content");
    expect(peer.hash).toBe(createHash("sha256").update("peer content").digest("hex"));
    const next = (await f.service.update({ ...ref, file_name: "renamed.md", data: Buffer.from("saved content") }))!;
    expect(next.id).toBe(file.id);
    expect(await text.read()).toBe("saved content");
    expect(await new Response(await f.service.read(next)).text()).toBe("saved content");
    expect(
      await f.service.update({ ...ref, project_id: "other", file_name: "private", data: Buffer.from("bad") }),
    ).toBeNull();
  } finally {
    await f.close();
  }
});
