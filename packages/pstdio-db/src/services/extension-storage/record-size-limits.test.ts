import { afterEach, expect, test } from "bun:test";
import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";
import { isStorageLimitError, type StorageGroup, storageLimits, storageRecordBytes } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

/** The persistent store and the in-memory store that SDK tests use must refuse the same saves. */
const implementations = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  return [
    { name: "database", records: createDocumentStorageDBService(f.db).open({ owner }).records },
    { name: "memory", records: createDocumentStorage({ owner, store: createMemoryDocumentStore() }).records },
  ];
};

/** A string value whose record is exactly `bytes` long. */
const sizedValue = (bytes: number) => "x".repeat(bytes - storageRecordBytes({ value: "", shared: null }));

const refusal = async (save: Promise<unknown>) => {
  const error = await save.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!isStorageLimitError(error)) throw new Error(`Expected a storage limit error, got ${String(error)}`);
  return error;
};

test("a record up to 256 KiB saves, and one byte more is refused without writing", async () => {
  for (const { name, records } of await implementations()) {
    await records.commit({
      operationId: `${name}-fits`,
      edits: [{ recordId: "fits", replace: sizedValue(storageLimits.recordBytes) }],
    });
    expect((await records.read("fits")).exists).toBe(true);

    const error = await refusal(
      records.commit({
        operationId: `${name}-too-large`,
        edits: [
          { recordId: "small", replace: "kept out" },
          { recordId: "too-large", replace: sizedValue(storageLimits.recordBytes + 1) },
        ],
      }),
    );
    expect(error.data).toEqual({
      limit: "record",
      recordId: "too-large",
      bytes: storageLimits.recordBytes + 1,
      maxBytes: storageLimits.recordBytes,
    });
    expect(error.message).toContain("ctx.storage.files");
    expect((await records.read("too-large")).exists).toBe(false);
    expect((await records.read("small")).exists).toBe(false);
  }
});

test("shared text counts toward the record limit", async () => {
  for (const { name, records } of await implementations()) {
    const text = "y".repeat(storageLimits.recordBytes - 100);
    await records.commit({
      operationId: `${name}-text`,
      edits: [{ recordId: "note", shared: [{ kind: "text.insert", index: 0, text }] }],
    });
    const error = await refusal(
      records.commit({
        operationId: `${name}-more-text`,
        edits: [{ recordId: "note", shared: [{ kind: "text.insert", index: 0, text: "z".repeat(200) }] }],
      }),
    );
    expect(error.data.recordId).toBe("note");
    expect((await records.read("note")).shared).toEqual({ kind: "text", value: text });
  }
});

test("a commit up to 4 MiB saves, and a larger commit is refused without writing", async () => {
  const group = (operationId: string, count: number, prefix: string): StorageGroup => ({
    operationId,
    edits: Array.from({ length: count }, (_, index) => ({
      recordId: `${prefix}-${index}`,
      replace: sizedValue(storageLimits.recordBytes),
    })),
  });
  const fitting = storageLimits.commitBytes / storageLimits.recordBytes;
  for (const { name, records } of await implementations()) {
    await records.commit(group(`${name}-fits`, fitting, "fits"));
    expect((await records.read(`fits-${fitting - 1}`)).exists).toBe(true);

    const error = await refusal(records.commit(group(`${name}-too-large`, fitting + 1, "over")));
    expect(error.data).toEqual({
      limit: "commit",
      bytes: storageLimits.commitBytes + storageLimits.recordBytes,
      maxBytes: storageLimits.commitBytes,
    });
    expect((await records.read("over-0")).exists).toBe(false);

    const inTransaction = await refusal(
      records.transaction((locked) => locked.commit(group(`${name}-locked`, fitting + 1, "locked"))),
    );
    expect(inTransaction.data.limit).toBe("commit");
    expect((await records.read("locked-0")).exists).toBe(false);
  }
});

test("deleting a record is never refused", async () => {
  for (const { name, records } of await implementations()) {
    await records.commit({ operationId: `${name}-add`, edits: [{ recordId: "item", replace: "value" }] });
    await records.commit({ operationId: `${name}-delete`, edits: [{ recordId: "item", deleted: true }] });
    expect((await records.read("item")).deleted).toBe(true);
  }
});
