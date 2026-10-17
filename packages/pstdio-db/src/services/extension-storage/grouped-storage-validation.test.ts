import { afterEach, expect, test } from "bun:test";
import type { GroupCommit } from "pstdio-sync";
import { openGroupedTestStorage } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("invalid or duplicate record changes cannot receive a local save receipt", async () => {
  const { records } = await openGroupedTestStorage(cleanup);
  const base = await records.read("note");
  const invalid: GroupCommit[] = [
    { operationId: "empty-group", edits: [] },
    { operationId: "empty-change", edits: [{ recordId: "note", expectedRevision: base.revision }] },
    {
      operationId: "duplicate-record",
      edits: [
        { recordId: "note", expectedRevision: base.revision, replace: "first" },
        { recordId: "note", expectedRevision: base.revision, replace: "second" },
      ],
    },
  ];
  for (const group of invalid) {
    let error: unknown;
    try {
      await records.commit(group);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((await records.read("note")).value).toBeNull();
  }
  const valid = {
    operationId: "valid",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "saved" }],
  };
  expect(await records.commit(valid)).toMatchObject({ status: "saved-locally" });
  let mismatch: unknown;
  try {
    await records.commit({ ...valid, edits: [{ ...valid.edits[0], replace: "changed identity" }] });
  } catch (error) {
    mismatch = error;
  }
  expect(mismatch).toBeInstanceOf(Error);
  expect((await records.read("note")).value).toBe("saved");
});
