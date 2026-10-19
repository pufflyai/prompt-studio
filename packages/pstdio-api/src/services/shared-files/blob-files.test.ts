import { expect, test } from "bun:test";
import { blobFilesFixture } from "./blob-files.fixture";

test("ordinary blob uploads commit immutable bytes and metadata to the shared journal", async () => {
  const f = await blobFilesFixture();
  try {
    const file = await f.service.upload({
      ...f.scope,
      file_name: "attachment.txt",
      mime_type: "text/plain",
      data: Buffer.from("ordinary uploaded bytes"),
    });
    expect(file).not.toBeNull();
    const state = await f.storage.readState();
    expect(state.pending).toHaveLength(1);
    const record = (await f.storage.records.list())[0]!;
    expect(await new Response(await f.assets.read(f.owner, record.asset!)).text()).toBe("ordinary uploaded bytes");
  } finally {
    await f.close();
  }
});

test("journal-backed blobs are readable without a local files row or the sender's instance ID", async () => {
  const a = await blobFilesFixture();
  const b = await blobFilesFixture();
  try {
    const uploaded = (await a.service.upload({
      ...a.scope,
      file_name: "photo.png",
      data: Buffer.from("shared bytes"),
      mime_type: "image/png",
    }))!;
    const original = (await a.storage.records.list())[0]!;
    const asset = await b.assets.stage(
      b.owner,
      crypto.randomUUID(),
      new Blob([await new Response(await a.assets.read(a.owner, original.asset!)).arrayBuffer()], {
        type: original.asset!.mediaType,
      }),
    );
    const before = await b.storage.records.read(original.recordId);
    await b.storage.records.commit({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId: original.recordId,
          expectedRevision: before.revision,
          replace: original.value,
          asset,
          deleted: false,
        },
      ],
    });
    const file = await b.service.getOwnedFile({
      ...b.scope,
      extension_instance_id: b.owner.extensionId,
      file_id: uploaded.id,
    });
    expect(file?.file_name).toBe("photo.png");
    expect(await new Response(await b.service.read(file!)).text()).toBe("shared bytes");
    expect(a.scope.extension_instance_id).not.toBe(b.scope.extension_instance_id);
  } finally {
    await b.close();
    await a.close();
  }
});

test("execution lists independent attachment scopes while retaining a conflicted attachment", async () => {
  const { withConflictReadBoundary } = await import("./conflict-read-boundary");
  const f = await blobFilesFixture();
  try {
    await f.service.upload({ ...f.scope, file_name: "conflicted.txt", data: Buffer.from("bytes") });
    const observed = (await f.storage.records.list())[0]!;
    for (const [operationId, name] of [
      ["winner", "accepted.txt"],
      ["branch", "alternative.txt"],
    ] as const) {
      await f.storage.records.commit({
        operationId,
        edits: [
          {
            recordId: observed.recordId,
            expectedRevision: observed.revision,
            replace: { ...(observed.value as object), name },
          },
        ],
      });
    }
    await withConflictReadBoundary(async () => {
      expect(await f.service.list({ ...f.scope, scope_type: "resource", scope_id: "independent" })).toEqual([]);
      await expect(f.service.list(f.scope)).rejects.toThrow("Unresolved storage conflict");
    });
  } finally {
    await f.close();
  }
});
