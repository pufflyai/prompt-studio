import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { deleteRecord, digest, listRecords, readRecord, saveRecord } from "./records";

test("project records persist values and content hashes ignore property order", async () => {
  const storage = createMemoryStorage();
  const draft = { id: "draft-one", values: { title: "Keep this draft" } };
  await saveRecord(storage, "draft", draft);
  expect((await readRecord<typeof draft>(storage, "draft", draft.id)).value).toEqual(draft);
  expect(await listRecords(storage, "draft")).toEqual([draft]);
  expect(digest(draft)).toBe(digest({ values: draft.values, id: draft.id }));
});

test("a new draft can reuse a discarded draft's identity", async () => {
  const storage = createMemoryStorage();
  const original = { id: "workspace-one-chapter-one", values: { kind: "assertion" } };
  await saveRecord(storage, "draft", original);
  await deleteRecord(storage, "draft", original.id);
  expect(await listRecords(storage, "draft")).toEqual([]);

  const replacement = { ...original, values: { kind: "measurement" } };
  await saveRecord(storage, "draft", replacement);
  expect((await readRecord<typeof replacement>(storage, "draft", original.id)).value).toEqual(replacement);
  expect(await listRecords(storage, "draft")).toEqual([replacement]);
});
