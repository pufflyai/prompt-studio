import { afterEach, expect, test } from "bun:test";
import { openGroupedTestStorage } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("an open alternative keeps later dependent work while unrelated records continue", async () => {
  const { records } = await openGroupedTestStorage(cleanup);
  const base = await records.read("note");
  await records.commit({
    operationId: "first",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "first accepted locally" }],
  });
  await records.commit({
    operationId: "alternative",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "retained alternative" }],
  });
  const alternative = await records.read("note", { operationId: "alternative" });
  expect(alternative.value).toBe("retained alternative");
  expect(
    await records.commit({
      operationId: "dependent",
      edits: [
        { recordId: "note", expectedRevision: alternative.revision, replace: "later alternative" },
        {
          recordId: "joined",
          expectedRevision: (await records.read("joined")).revision,
          replace: "keep with the branch",
        },
      ],
    }),
  ).toMatchObject({ status: "conflict", state: "needs-attention", conflictId: "alternative" });
  expect((await records.read("note")).value).toBe("first accepted locally");
  expect((await records.read("joined")).value).toBeNull();
  await records.commit({
    operationId: "unrelated",
    edits: [{ recordId: "other", expectedRevision: (await records.read("other")).revision, replace: "continues" }],
  });
  expect((await records.read("other")).value).toBe("continues");
  const [summary] = await records.conflicts();
  const conflict = await records.inspect(summary.conflictId);
  expect(conflict.alternatives.map((entry) => entry.operationId)).toEqual(["alternative", "dependent"]);
});
