import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { storageRecordId } from "pstdio-sync/records";
import { blobFilesFixture } from "./shared-files/blob-files.fixture";

test("native blob response bytes match the metadata snapshot used for its ETag", async () => {
  const f = await blobFilesFixture();
  try {
    const file = (await f.service.upload({ ...f.scope, file_name: "note.md", data: Buffer.from("abc") }))!;
    const ref = { ...f.scope, file_id: file.id },
      key = "b".repeat(64);
    await f.storage.records.bindText({
      recordId: storageRecordId(["blob-file"], file.id),
      documentKey: key,
      content: "abc",
    });
    const row = (await f.service.getOwnedFile(ref))!;
    const text = f.fileDeps.extensionStorageService.openNativeTextDocument({ owner: f.owner, fileId: key });
    await text.save("a newer native body");
    const actual = await new Response(await f.service.read(row)).text();
    const digest = createHash("sha256").update(actual).digest("hex");
    console.log("served body:", JSON.stringify(actual), "response hash:", row.hash, "actual hash:", digest);
    expect(digest).toBe(row.hash);
    expect(Buffer.byteLength(actual)).toBe(row.size_bytes);
  } finally {
    await f.close();
  }
});
