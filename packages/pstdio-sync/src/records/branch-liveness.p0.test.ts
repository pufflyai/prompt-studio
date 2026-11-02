import { expect, test } from "bun:test";
import { createRecordStorage } from "./storage";
import type { GroupedState } from "./types";

test("choosing a retained edit restores the live record observed by its author", async () => {
  const owner = { workbenchId: "workbench", extensionId: "documents" };
  const state: GroupedState = { owner, accepted: null, journal: [] };
  const storage = createRecordStorage({
    owner,
    environmentId: "writer",
    store: {
      transaction: async (_owner, action) => action(state),
    },
  });
  const initial = await storage.records.read("note");
  await storage.records.commit({
    operationId: "base",
    edits: [{ recordId: "note", expectedRevision: initial.revision, replace: "base" }],
  });
  const base = await storage.records.read("note");
  await storage.records.commit({
    operationId: "delete",
    edits: [{ recordId: "note", expectedRevision: base.revision, deleted: true }],
  });
  await storage.records.commit({
    operationId: "offline-edit",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "retained edit" }],
  });
  const conflict = (await storage.records.conflicts())[0]!;
  const branch = await storage.records.read("note", { operationId: "offline-edit" });
  expect(branch.deleted).toBe(false);
  const inspection = await storage.records.inspect(conflict.conflictId);
  await storage.records.resolve({ ...inspection, operationId: "choose-edit", choose: "local" });
  const result = await storage.records.read("note");
  expect(result.deleted).toBe(false);
  expect(result.value).toBe("retained edit");
  expect(await storage.records.conflicts()).toEqual([]);
});
