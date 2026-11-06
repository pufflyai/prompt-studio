import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { digest, listRecords, readRecord, saveRecord } from "./records";

test("project records persist values and content hashes ignore property order", async () => {
  const storage = createMemoryStorage();
  const draft = { id: "draft-one", values: { title: "Keep this draft" } };
  await saveRecord(storage, "draft", draft);
  expect((await readRecord<typeof draft>(storage, "draft", draft.id)).value).toEqual(draft);
  expect(await listRecords(storage, "draft")).toEqual([draft]);
  expect(digest(draft)).toBe(digest({ values: draft.values, id: draft.id }));
});
